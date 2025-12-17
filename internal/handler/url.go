package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/armistcxy/shorten/internal/background"
	"github.com/armistcxy/shorten/internal/cache"
	"github.com/armistcxy/shorten/internal/domain"
	"github.com/armistcxy/shorten/internal/msq"
	"github.com/armistcxy/shorten/internal/util"
	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
	"golang.org/x/sync/singleflight"
)

// This will deal with 2 end points
// /short/:id GET => Return original url
// /create?url= POST => Return short url
type URLHandler struct {
	urlRepo     domain.URLRepository
	idGen       domain.IDGenerator
	cache       cache.Cache
	pub         *msq.URLPublisher
	riverClient *river.Client[pgx.Tx]
	inputs      []domain.CreateInput
	viewManager *ViewManager
	viewCache   cache.ViewCache
	group       singleflight.Group
	mu          sync.Mutex
}

func NewURLHandler(urlRepo domain.URLRepository, idGen domain.IDGenerator, cache cache.Cache,
	pub *msq.URLPublisher, riverClient *river.Client[pgx.Tx], viewCache cache.ViewCache) *URLHandler {
	return &URLHandler{
		urlRepo:     urlRepo,
		idGen:       idGen,
		cache:       cache,
		pub:         pub,
		riverClient: riverClient,
		inputs:      make([]domain.CreateInput, 0),
		viewManager: NewViewManager(),
		viewCache:   viewCache,
		group:       singleflight.Group{},
		mu:          sync.Mutex{},
	}
}

// GetOriginURLHandle handles the GET request to retrieve the original URL for a given short URL ID.
// It extracts the ID from the request path, looks up the original URL in the URLRepository,
// and encodes the original URL as a JSON response.
func (uh *URLHandler) GetOriginURLHandle(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	id := parts[len(parts)-1]

	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	originURL, err := uh.cache.Get(cacheCtx, id)
	if err != nil {
		slog.Error("failed when trying to retrieve entry from cache", "error", err.Error())
	} else if originURL != "" {
		go func() {
			uh.viewManager.counter.Increase(id)
		}()
		util.EncodeJSON(w, map[string]string{"origin": originURL})
		return
	}

	_, err, _ = uh.group.Do(id, func() (interface{}, error) {
		dbQueryCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		originURL, err = uh.urlRepo.Get(dbQueryCtx, id)
		if err != nil {
			slog.Error("fail to retrieve origin url", "error", err.Error())
			return nil, err
		}
		setCacheCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if setCacheErr := uh.cache.Set(setCacheCtx, id, originURL); err != nil {
			slog.Error("failed to set k-v to cache", "id", id, "origin", originURL, "error", setCacheErr.Error())
		}
		return nil, nil
	})

	if err != nil {
		http.Error(w, fmt.Sprintf("fail to retrieve origin url, error: %s", err), http.StatusInternalServerError)
		return
	}
	go func() {
		uh.viewManager.counter.Increase(id)
	}()

	util.EncodeJSON(w, map[string]string{"origin": originURL})
}

// CreateShortURLHandle handles the POST request to create a new short URL.
// It extracts the original URL from the request, creates a new short URL using the URLRepository,
// and encodes the short URL as a JSON response.
func (uh *URLHandler) CreateShortURLHandle(w http.ResponseWriter, r *http.Request) {
	form := CreateShortForm{}
	if err := util.DecodeJSON(r, &form); err != nil {
		slog.Error("fail when decoding json body", "error", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	id := uh.idGen.GenerateID()

	// Add k-v pair (id:origin_url) to cache for 5 minutes
	cacheCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := uh.cache.Set(cacheCtx, id, form.Origin); err != nil {
		slog.Error("failed to set k-v to cache", "id", id, "origin", form.Origin, "error", err.Error())
	}

	go func() {
		if err := uh.pub.EnqueueURL(context.Background(), form.Origin, id); err != nil {
			slog.Error("failed to enequeue url", "url", form.Origin, "url_id", id, "error", err.Error())
		}
		if _, err := uh.riverClient.Insert(context.Background(), background.IncreaseCountArgs{
			ID: id,
		}, nil); err != nil {
			slog.Error("failed to enqueue increase view jobs", "url_id", id, "error", err.Error())
		}
		uh.mu.Lock()
		defer uh.mu.Unlock()
		uh.inputs = append(uh.inputs, domain.CreateInput{ID: id, URL: form.Origin})
	}()

	util.EncodeJSON(w, map[string]interface{}{"id": id, "origin": form.Origin})
}

type CreateShortForm struct {
	Origin string `json:"origin"`
}

func (uh *URLHandler) RetrieveFraudURLHandle(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	id := parts[len(parts)-1]

	fraud, err := uh.urlRepo.RetrieveFraud(context.Background(), id)
	if err != nil {
		slog.Error("fail to retrieve fraud from database", "error", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	util.EncodeJSON(w, map[string]interface{}{"fraud": fraud})
}

func (uh *URLHandler) GetURLView(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	id := parts[len(parts)-1]

	var (
		count    int
		result   string
		err      error
		cacheKey string = fmt.Sprintf("count:%s", id)
	)

	getCacheCtx, gCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer gCancel()
	result, err = uh.cache.Get(getCacheCtx, cacheKey)
	if err != nil {
		slog.Error("fail to get view from cache", "error", err.Error())
	} else if result != "" {
		count, err = strconv.Atoi(result)
		if err != nil {
			slog.Error("fail to parse cache query result", "error", err.Error())
		} else {
			util.EncodeJSON(w, map[string]interface{}{"count": count})
			return
		}
	}

	count, err = uh.urlRepo.GetView(context.Background(), id)
	if err != nil {
		slog.Error("fail to get view from database", "error", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	// setCacheCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
	// defer sCancel()
	// err = uh.cache.SetWithTTL(setCacheCtx, cacheKey)

	// Old implementation
	count += uh.viewManager.counter.Get(id)
	count = max(count, uh.viewManager.GetLast(id))
	uh.viewManager.UpdateLast(id, count)

	util.EncodeJSON(w, map[string]interface{}{"count": count})
}

// BatchCreate is a background process that periodically batches and creates URL entries in the system.
// It collects URL creation requests in a buffer, and every 5 seconds or when the buffer reaches 1000 entries,
// it batches the requests and creates them in the URL repository. If there is an error during the batch creation,
// it will enqueue the batch to be retried in the background.
func (uh *URLHandler) BatchCreate() {
	start := time.Now()
	for {
		uh.mu.Lock()
		if len(uh.inputs) >= 1000 || (time.Since(start) >= 5*time.Second && len(uh.inputs) > 0) {
			if err := uh.urlRepo.BatchCreate(context.Background(), uh.inputs); err != nil {
				slog.Error("failed to perform batch create", "error", err.Error())
				// enqueue to background process to retry batch create again
				ids := make([]string, len(uh.inputs))
				originURLs := make([]string, len(uh.inputs))
				for i := range len(uh.inputs) {
					ids[i] = uh.inputs[i].ID
					originURLs[i] = uh.inputs[i].URL
				}
				if _, err = uh.riverClient.Insert(context.Background(), background.BatchCreateArgs{
					IDs:        ids,
					OriginURLs: originURLs,
				}, nil); err != nil {
					slog.Error("failed to enqueue retry batch create task", "error", err.Error())
				}
			}
			start = time.Now()
			uh.inputs = make([]domain.CreateInput, 0)
		}
		uh.mu.Unlock()
	}
}

// BatchUpdateView is a background process that periodically updates the view count for URLs in the system.
// It retrieves the current view counts from an in-memory counter, resets the counter, and then inserts the view counts
// into a separate system for further processing.
// This function runs in a separate goroutine and is triggered by a 20-second ticker.
func (uh *URLHandler) BatchUpdateView() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		data := uh.viewManager.counter.Snapshot()

		for id, cnt := range data {
			if _, err := uh.riverClient.Insert(context.Background(), background.IncreaseCountArgs{
				ID:    id,
				Count: cnt,
			}, nil); err != nil {
				slog.Error("failed to enqueue increase view URL job", "error", err.Error())
			}
		}

		uh.viewManager.counter.Reset()
	}
}

type ViewManager struct {
	mu       sync.Mutex
	counter  *Counter
	lastView map[string]int
}

func NewViewManager() *ViewManager {
	return &ViewManager{
		mu:       sync.Mutex{},
		counter:  NewCounter(),
		lastView: make(map[string]int),
	}
}

func (vm *ViewManager) GetLast(id string) int {
	vm.mu.Lock()
	defer vm.mu.Unlock()
	return vm.lastView[id]
}

func (vm *ViewManager) UpdateLast(id string, val int) {
	vm.mu.Lock()
	defer vm.mu.Unlock()
	vm.lastView[id] = val
}

// Counter is a thread-safe counter that keeps track of the count for a set of keys.
type Counter struct {
	mu  sync.Mutex
	cnt map[string]int
}

func NewCounter() *Counter {
	return &Counter{
		mu:  sync.Mutex{},
		cnt: make(map[string]int),
	}
}

func (c *Counter) Increase(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cnt[key]++
}

func (c *Counter) Get(key string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cnt[key]
}

func (c *Counter) Size() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.cnt)
}

// Snapshot retrieves a copy of the current counter data and resets it
func (c *Counter) Snapshot() map[string]int {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Create a copy of the current data
	snapshot := make(map[string]int, len(c.cnt))
	for k, v := range c.cnt {
		snapshot[k] = v
	}

	return snapshot
}

func (c *Counter) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cnt = make(map[string]int)
}
