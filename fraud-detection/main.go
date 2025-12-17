package main

import (
	"log"
	"os"

	"github.com/jmoiron/sqlx"

	_ "github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"
)

// TODO: change Redis k-v if find out URL is fraud
func main() {
	msqURL := os.Getenv("RABBITMQ_URL")
	conn, err := amqp.Dial(msqURL)
	if err != nil {
		log.Fatalf("failed to establish connection to RabbitMQ, error: %s", err.Error())
	}

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("failed to create channel (AMQP virtual connection), error: %s", err.Error())
	}
	defer ch.Close()

	if err = ch.ExchangeDeclare("url", "fanout", true, false, false, false, nil); err != nil {
		panic(err)
	}

	q, err := ch.QueueDeclare("", false, false, true, false, nil)
	if err != nil {
		log.Fatalf("failed to declare queue, error: %s", err.Error())
	}

	if err = ch.QueueBind(q.Name, "", "url", false, nil); err != nil {
		log.Fatalf("failed to bind queue, error: %s", err.Error())
	}

	urlCh, err := ch.Consume(q.Name, "", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("failed to create a channel to start consuming messages, error: %s", err.Error())
	}

	db := sqlx.MustConnect("postgres", os.Getenv("URL_DSN"))

	suWorker := NewScanURLWorker(urlCh, db)

	suWorker.work()

}
