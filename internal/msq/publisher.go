package msq

import (
	"context"
	"encoding/json"

	amqp "github.com/rabbitmq/amqp091-go"
)

type URLPublisher struct {
	urlCh *amqp.Channel
}

func NewURLPublisher(conn *amqp.Connection) *URLPublisher {
	ch, err := conn.Channel()
	if err != nil {
		panic(err)
	}

	if err = ch.ExchangeDeclare("url", "fanout", true, false, false, false, nil); err != nil {
		panic(err)
	}

	return &URLPublisher{
		urlCh: ch,
	}
}

func (up *URLPublisher) EnqueueURL(ctx context.Context, url string, id string) error {
	data := map[string]string{
		"url": url,
		"id":  id,
	}
	jsonPayload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if err = up.urlCh.PublishWithContext(ctx, "url", "", false, false, amqp.Publishing{
		ContentType: "application/json",
		Body:        jsonPayload,
	}); err != nil {
		return err
	}

	return nil
}
