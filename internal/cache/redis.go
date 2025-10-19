package cache

import (
	"context"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisCache struct {
	client *redis.Client
}

func NewRedisCache(redisURL string) *RedisCache {
	// There is an error when using directly redis URL as address
	// Use ParseURL instead as suggest from the issue below
	// https://github.com/redis/go-redis/issues/864
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		panic(err)
	}
	client := redis.NewClient(&redis.Options{
		Addr: opt.Addr,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = client.Ping(ctx).Err(); err != nil {
		panic(err)
	}
	return &RedisCache{client: client}
}

func (rc *RedisCache) Get(ctx context.Context, id string) (string, error) {
	val, err := rc.client.Get(ctx, id).Result()
	if err != nil {
		if err == redis.Nil {
			return "", nil
		}
		return "", err
	}
	return val, nil
}

func (rc *RedisCache) Set(ctx context.Context, id string, url string) error {
	return rc.client.Set(ctx, id, url, 0).Err()
}

func (rc *RedisCache) SetWithTTL(ctx context.Context, id string, url string, ttl time.Duration) error {
	return rc.client.Set(ctx, id, url, ttl).Err()
}

type RedisClusterCache struct {
	client *redis.ClusterClient
}

func NewRedisClusterCache(redisURLs []string) *RedisClusterCache {
	parsedURLs := make([]string, len(redisURLs))
	for i := range parsedURLs {
		if opt, err := redis.ParseURL(redisURLs[i]); err != nil {
			panic(err)
		} else {
			parsedURLs[i] = opt.Addr
		}
	}
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs: parsedURLs,
	})
	return &RedisClusterCache{client: client}
}

func (rcc *RedisClusterCache) Get(ctx context.Context, id string) (string, error) {
	val, err := rcc.client.Get(ctx, id).Result()
	if err != nil {
		if err == redis.Nil {
			return "", nil
		}
		return "", err
	}
	return val, nil
}

func (rcc *RedisClusterCache) Set(ctx context.Context, id string, url string) error {
	return rcc.client.Set(ctx, id, url, 0).Err()
}

func (rcc *RedisClusterCache) SetWithTTL(ctx context.Context, id string, url string, ttl time.Duration) error {
	return rcc.client.Set(ctx, id, url, ttl).Err()
}

type ViewRedisCache struct {
	client *redis.ClusterClient
}

func NewViewRedisCache(redisURLs []string) *ViewRedisCache {
	parsedURLs := make([]string, len(redisURLs))
	for i := range parsedURLs {
		if opt, err := redis.ParseURL(redisURLs[i]); err != nil {
			panic(err)
		} else {
			parsedURLs[i] = opt.Addr
		}
	}
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs: parsedURLs,
	})
	return &ViewRedisCache{client: client}
}

func (vc *ViewRedisCache) Get(ctx context.Context, key string) (int, error) {
	val, err := vc.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return -1, nil
		}
		return -1, err
	}
	view, err := strconv.Atoi(val)
	if err != nil {
		return -1, err
	}
	return view, nil
}

func (vc *ViewRedisCache) Set(ctx context.Context, key string, count int) error {
	return vc.client.Set(ctx, key, count, 0).Err()
}

func (vc *ViewRedisCache) SetWithTTL(ctx context.Context, key string, count int, ttl time.Duration) error {
	return vc.client.Set(ctx, key, count, ttl).Err()
}

func (vc *ViewRedisCache) Increase(ctx context.Context, key string) error {
	return vc.client.Incr(ctx, key).Err()
}
