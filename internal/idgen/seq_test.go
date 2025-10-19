package idgen

import (
	"os"
	"sync"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
)

func TestNewSeqIDGenerator(t *testing.T) {
	var (
		db             *sqlx.DB = sqlx.MustConnect("postgres", os.Getenv("URL_DSN"))
		start          uint64   = 1
		numberOfShards int      = 12
	)

	sg := NewSeqIDGenerator(db, start, numberOfShards, nil)
	for i := range sg.shards {
		assert.NotNil(t, &sg.shards[i])
		t.Logf("Shard %d starts from: %d, end at %d, last used id: %d\n", i, sg.shards[i].start, sg.shards[i].end, sg.shards[i].cur)
	}
}

func TestSeqGenerateIDSequential(t *testing.T) {
	var (
		numberOfYieldIDs int = 5
	)
	sg := prepareSeqIDGenerator()
	used := make(map[string]struct{})
	for range numberOfYieldIDs {
		id := sg.GenerateID()
		if _, appear := used[id]; appear {
			t.Errorf("id %s has already been used before", id)
		} else {
			used[id] = struct{}{}
			t.Logf("generated id: %s\n", id)
		}
	}
}

func TestSeqGenerateIDConcurrency(t *testing.T) {
	var (
		numberOfYieldIDs int = 2000
		numberOfWorkers  int = 2000
	)
	sg := prepareSeqIDGenerator()
	used := sync.Map{}

	wg := sync.WaitGroup{}
	for i := range numberOfWorkers {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for range numberOfYieldIDs {
				id := sg.GenerateID()
				if ownerID, appear := used.Load(id); appear {
					t.Errorf("id %s has already been used before by worker %v\n", id, ownerID)
				} else {
					used.Store(id, workerID)
					t.Logf("generated id: %s\n", id)
				}
			}
		}(i)
	}

	wg.Wait()

}

func BenchmarkSeqGenerateID(b *testing.B) {
	/*
		2000 workers(goroutines) for simulation
	*/
	var (
		numberOfYieldIDs int             = 500
		numberOfWorkers  int             = 2000
		wg                               = sync.WaitGroup{}
		sg               *SeqIDGenerator = prepareSeqIDGenerator()
	)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for range numberOfWorkers {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for range numberOfYieldIDs {
					sg.GenerateID()
				}
			}()
		}

		wg.Wait()
	}

	/*
		go test -bench=BenchmarkSeqGenerateID -benchtime=5m
		goos: linux
		goarch: amd64
		pkg: github.com/armistcxy/shorten/internal/idgen
		cpu: AMD Ryzen 5 5600U with Radeon Graphics
		BenchmarkSeqGenerateID-12           6944          56338958 ns/op
		PASS
		ok      github.com/armistcxy/shorten/internal/idgen     412.245s
	*/

	// 56ms for 10^6 request
	// => which also mean it is capable of 1s/56ms * 10^6 = 17,857,142 operations per sec
}

func prepareSeqIDGenerator() *SeqIDGenerator {
	var (
		db             *sqlx.DB = sqlx.MustConnect("postgres", os.Getenv("URL_DSN"))
		start          uint64   = 1
		numberOfShards int      = 12
	)

	return NewSeqIDGenerator(db, start, numberOfShards, nil)
}
