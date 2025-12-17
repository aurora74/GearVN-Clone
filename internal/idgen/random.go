package idgen

import (
	"time"

	"math/rand"
)

// Implement IDGenerator interface with totally random method
type RandomIDGenerator struct {
}

func NewRandomIDGenerator() *RandomIDGenerator {
	return &RandomIDGenerator{}
}

func (rg *RandomIDGenerator) GenerateID() string {
	return randomString(idLen)
}

const (
	idLen   int    = 6
	charset string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
)

func randomString(length int) string {
	seed := rand.NewSource(time.Now().UnixNano())
	r := rand.New(seed)
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[r.Intn(len(charset))]
	}
	return string(b)
}
