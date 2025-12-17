package main

import (
	"encoding/json"
	"log"
	"log/slog"
	"time"

	"github.com/jmoiron/sqlx"
	amqp "github.com/rabbitmq/amqp091-go"
)

type ScanURLWorker struct {
	urlCh <-chan amqp.Delivery
	db    *sqlx.DB
}

func NewScanURLWorker(urlCh <-chan amqp.Delivery, db *sqlx.DB) ScanURLWorker {
	return ScanURLWorker{
		urlCh: urlCh,
		db:    db,
	}
}

// Due to the limit of VirusTotal Public API (Quota: 4 requests/minute)
var (
	restTime = 1 * time.Minute
	quota    = 4
)

type ScanMessageForm struct {
	ID  string `json:"id"`  // ID of shorten URL in database
	URL string `json:"url"` // Original URL that needed to check whether fraud or not
}

func (sw ScanURLWorker) work() {
	ticker := time.NewTicker(restTime)
	defer ticker.Stop()

	var msg ScanMessageForm
	for range ticker.C {
		for range quota {
			delivery := <-sw.urlCh
			err := json.Unmarshal(delivery.Body, &msg)
			if err != nil {
				slog.Error("Failed to unmarshal JSON payload", "error", err.Error())
				continue
			}

			isFraud, err := scanURL(msg.URL)
			if err != nil {
				slog.Error("failed when scanning URL", "error", err.Error())
				continue
			}

			if isFraud {
				log.Printf("%s is fraud\n", msg.URL)
				if err := markURLAsFraud(sw.db, msg.ID); err != nil {
					slog.Error("failed to mark url as fraud in database", "error", err.Error())
				}
			} else {
				log.Printf("%s is clean\n", msg.URL)
			}
		}
	}
}
