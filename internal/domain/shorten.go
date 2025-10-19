package domain

import (
	"math/rand"
	"time"
)

// Use k-v store might be better than using Postgres (we only need hash : real_url)

// But there is a way we can do it with Postgres, or even sqlite, that we use auto increment ID => encode into string

const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func RandomString(length int) string {
	seed := rand.NewSource(time.Now().UnixNano())
	r := rand.New(seed)
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[r.Intn(len(charset))]
	}
	return string(b)
}

// Rate of collision: Extremely low IMO, 2 calls exactly the same nanosecond to potentially generate the same sequence
// Thanks to high resolution of UnixNano

// Discussion
// How about using encode from auto-increment id from database ? (Already think about it, what if the url is stale ? Remove it and can't do anything with that id again ?)
// Any idea ???

const (
	BASE uint64 = 62
	// DIGIT_OFFSET     int64 = 0
	// LOWERCASE_OFFSET int64 = 10
	// UPPERCASE_OFFSET int64 = 36
)

func EncodeID(num uint64) string {
	var encoded []byte
	for num > 0 {
		encoded = append(encoded, characters[num%BASE])
		num /= BASE
	}

	for i, j := 0, len(encoded)-1; i < j; i, j = i+1, j-1 {
		encoded[i], encoded[j] = encoded[j], encoded[i]
	}

	return string(encoded)
}

func DecodeID(id string) uint64 {
	var num uint64
	for i := range id {
		num = num*62 + uint64(char2order(id[i]))
	}
	return num
}

func char2order(ch byte) int {
	for i := range characters {
		if characters[i] == ch {
			return i
		}
	}
	return -1
}

var characters = []byte{
	'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
	'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
	'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
	'u', 'v', 'w', 'x', 'y', 'z',
	'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
	'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
	'U', 'V', 'W', 'X', 'Y', 'Z',
}
