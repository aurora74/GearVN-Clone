package cache

import (
	"context"
	"time"

	"github.com/dgraph-io/ristretto/v2"
)

type RistrettoCache struct {
	cache *ristretto.Cache[string, string]
}

func NewRistrettoCache(cache *ristretto.Cache[string, string]) *RistrettoCache {
	return &RistrettoCache{
		cache: cache,
	}
}

func (c *RistrettoCache) Get(_ context.Context, id string) (string, error) {
	value, found := c.cache.Get(id)
	if !found {
		return "", nil
	}
	return value, nil
}

func (c *RistrettoCache) Set(_ context.Context, id string, url string) error {
	c.cache.Set(id, url, 1)
	return nil
}

func (c *RistrettoCache) SetWithTTL(_ context.Context, id string, url string, ttl time.Duration) error {
	c.cache.SetWithTTL(id, url, 1, ttl)
	return nil
}
