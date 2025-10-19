package background

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"log/slog"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jmoiron/sqlx"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"
)

type AddLastUsedIDArgs struct {
	LastUsedID uint64
}

func (AddLastUsedIDArgs) Kind() string {
	return "add_last_used_id"
}

type AddLastUsedIDWorker struct {
	db *sqlx.DB
	river.WorkerDefaults[AddLastUsedIDArgs]
}

func NewAddLastUsedIDWorker(db *sqlx.DB) *AddLastUsedIDWorker {
	return &AddLastUsedIDWorker{
		db: db,
	}
}

func (aw *AddLastUsedIDWorker) Work(ctx context.Context, job *river.Job[AddLastUsedIDArgs]) error {
	return updateLastUsedID(aw.db, job.Args.LastUsedID)
}

// Mark this as a work for worker to make sure this operation must be done (retry if failed)
func updateLastUsedID(db *sqlx.DB, id uint64) error {
	query := "INSERT INTO ids(id) VALUES ($1) ON CONFLICT(id) DO NOTHING;"
	// don't know whether duplicate can happen, just to make sure everything works fine
	_, err := db.Exec(query, id)
	if err != nil {
		return err
	}

	query = "SELECT COUNT(*) FROM ids WHERE id=$1"
	var count int
	if err = db.Get(&count, query, id); err != nil {
		return err
	}
	if count == 0 {
		return fmt.Errorf("failed to insert ID %d", id)
	}
	slog.Info("Update last used id successfully", "id", id)
	return nil
}

type IncreaseCountArgs struct {
	ID    string
	Count int
}

func (IncreaseCountArgs) Kind() string {
	return "increase_count"
}

type IncreaseCountWorker struct {
	db      *sqlx.DB
	mu      sync.Mutex
	counter map[string]int
	river.WorkerDefaults[IncreaseCountArgs]
}

func NewIncreaseCountWorker(db *sqlx.DB) *IncreaseCountWorker {
	return &IncreaseCountWorker{
		db:      db,
		mu:      sync.Mutex{},
		counter: make(map[string]int),
	}
}

func (iw *IncreaseCountWorker) Work(ctx context.Context, job *river.Job[IncreaseCountArgs]) error {
	iw.mu.Lock()
	defer iw.mu.Unlock()
	iw.counter[job.Args.ID] += job.Args.Count
	return nil
}

var (
	batchUpdateQuery = `
		UPDATE urls AS u
		SET count = u.count + c.new_count::integer
		FROM (VALUES %s) AS c(id, new_count)
		WHERE u.id = c.id;
	`
)

func (iw *IncreaseCountWorker) BatchUpdate() error {
	iw.mu.Lock()
	defer iw.mu.Unlock()

	valuesBuilder := strings.Builder{}
	params := []interface{}{}

	i := 1
	for id, cnt := range iw.counter {
		valuesBuilder.WriteString(fmt.Sprintf("($%d, $%d),", i, i+1))
		params = append(params, id, cnt)
		i += 2
	}

	if len(params) == 0 {
		return nil
	}

	values := valuesBuilder.String()
	values = values[:len(values)-1]

	query := fmt.Sprintf(batchUpdateQuery, values)
	log.Printf("Query statement: %s\n", query)

	if _, err := iw.db.Exec(query, params...); err != nil {
		return err
	}

	iw.counter = make(map[string]int)
	return nil
}

type BatchCreateArgs struct {
	IDs        []string
	OriginURLs []string
}

func (BatchCreateArgs) Kind() string {
	return "batch_create"
}

type BatchCreateWorker struct {
	db *sqlx.DB
	river.WorkerDefaults[BatchCreateArgs]
}

func NewBatchCreateWorker(db *sqlx.DB) *BatchCreateWorker {
	return &BatchCreateWorker{
		db: db,
	}
}

func (bw *BatchCreateWorker) Work(ctx context.Context, job *river.Job[BatchCreateArgs]) error {
	byteBuffer := bytes.NewBufferString(`INSERT INTO urls (id, original_url) VALUES `)
	tuples := make([]string, len(job.Args.IDs))
	for i := range tuples {
		tuples[i] = fmt.Sprintf("('%s', '%s')", job.Args.IDs[i], job.Args.OriginURLs[i])
	}
	byteBuffer.WriteString(strings.Join(tuples, ","))

	query := byteBuffer.String()
	if _, err := bw.db.ExecContext(ctx, query); err != nil {
		return err
	}
	return nil
}

func Migrate(ctx context.Context, dbPool *pgxpool.Pool) error {
	migrator, err := rivermigrate.New(riverpgxv5.New(dbPool), nil)
	if err != nil {
		return err
	}
	_, err = migrator.Migrate(ctx, rivermigrate.DirectionUp, nil)
	if err != nil {
		return err
	}
	return nil
}
