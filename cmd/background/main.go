package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/armistcxy/shorten/internal/background"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

func main() {
	riverDSN := os.Getenv("RIVER_DSN")
	dbPool, err := pgxpool.New(context.Background(), riverDSN)
	if err != nil {
		log.Fatal(err)
	}

	if err := background.Migrate(context.Background(), dbPool); err != nil {
		log.Fatal(err)
	}

	urlDSN := os.Getenv("URL_DSN")
	db := sqlx.MustConnect("postgres", urlDSN)

	workers := river.NewWorkers()
	river.AddWorker(workers, background.NewAddLastUsedIDWorker(db))

	batchCreateWorker := background.NewBatchCreateWorker(db)
	river.AddWorker(workers, batchCreateWorker)

	incCntWorker := background.NewIncreaseCountWorker(db)
	river.AddWorker(workers, incCntWorker)

	go func() {
		start := time.Now()

		for {
			if time.Since(start) >= 1*time.Second {
				if err := incCntWorker.BatchUpdate(); err != nil {
					slog.Error("failed to perform batch update on increasing 'count' field", "error", err.Error())
				}
				start = time.Now()
			}
		}
	}()

	riverClient, err := river.NewClient(riverpgxv5.New(dbPool), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault: {MaxWorkers: 100},
		},
		Workers: workers,
	})

	if err != nil {
		log.Fatal(err)
	}

	if err = riverClient.Start(context.Background()); err != nil {
		log.Fatal(err)
	}

	log.Println("Background worker has started working")
	log.Fatal(http.ListenAndServe(":8010", nil))
}
