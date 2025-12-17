package domain

import (
	"context"
	"time"
)

type ShortURL struct {
	ID        string    `json:"id"`
	Origin    string    `json:"origin"`
	CreatedAt time.Time `json:"created_at,omitempty"`
	Fraud     bool      `json:"fraud"`
}

type URLRepository interface {
	Create(ctx context.Context, id string, url string) (*ShortURL, error)
	Get(ctx context.Context, id string) (string, error)
	RetrieveFraud(ctx context.Context, id string) (bool, error)
	GetView(ctx context.Context, id string) (int, error)
	BatchCreate(ctx context.Context, inputs []CreateInput) error
}

type IDGenerator interface {
	GenerateID() string
}

type CreateInput struct {
	ID  string
	URL string
}
