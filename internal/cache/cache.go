package cache

import (
	"context"
	"time"
)

type Cache interface {
	Get(ctx context.Context, id string) (string, error)
	Set(ctx context.Context, id string, url string) error
	SetWithTTL(ctx context.Context, id string, url string, ttl time.Duration) error
}

type ViewCache interface {
	Get(ctx context.Context, key string) (int, error)
	Set(ctx context.Context, key string, count int) error
	SetWithTTL(ctx context.Context, key string, count int, ttl time.Duration) error
	Increase(ctx context.Context, key string) error
}
