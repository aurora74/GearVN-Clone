package msq

import (
	"context"
	"os"
	"testing"

	amqp "github.com/rabbitmq/amqp091-go"
)

func TestNewURLPublisher(t *testing.T) {
	// Setup test connection
	rabbitMQURL := os.Getenv("RABBITMQ_URL")
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		t.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()

	// Test publisher creation
	publisher := NewURLPublisher(conn)
	if publisher == nil {
		t.Error("Expected publisher to not be nil")
		return
	}
	if publisher.urlCh == nil {
		t.Error("Expected channel to not be nil")
	}
}

func TestEnqueueURL(t *testing.T) {
	// Setup test connection
	rabbitMQURL := os.Getenv("RABBITMQ_URL")
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		t.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()

	publisher := NewURLPublisher(conn)
	defer publisher.urlCh.Close()

	// Test cases
	testcases := []struct {
		testname string
		url      string
		id       string
		wantErr  bool
	}{
		{
			testname: "Trivial test with fraud link",
			url:      "http://www.marketingbyinternet.com/mo/e56508df639f6ce7d55c81ee3fcd5ba8/",
			id:       "123",
			wantErr:  false,
		},
	}

	ctx := context.Background()
	for _, tc := range testcases {
		t.Run(tc.testname, func(t *testing.T) {
			err := publisher.EnqueueURL(ctx, tc.url, tc.id)
			if (err != nil) != tc.wantErr {
				t.Errorf("EnqueueURL() error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}
