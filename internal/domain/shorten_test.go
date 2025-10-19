package domain

import (
	"math/rand/v2"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
)

func benchmarkGenerateRandomString(len int, b *testing.B) {
	var s string
	for range b.N {
		s = RandomString(len)
	}
	runtime.KeepAlive(s)
}

func BenchmarkGenerateRandomStringLength4(b *testing.B) {
	benchmarkGenerateRandomString(4, b)
}

func BenchmarkGenerateRandomStringLength5(b *testing.B) {
	benchmarkGenerateRandomString(5, b)
}

func BenchmarkGenerateRandomStringLength6(b *testing.B) {
	benchmarkGenerateRandomString(6, b)
}

/*
go test -bench=Benchmark -benchmem
goos: linux
goarch: amd64
pkg: shorten/internal
cpu: AMD Ryzen 5 5600U with Radeon Graphics
BenchmarkGenerateRandomStringLength4-12           110550             10698 ns/op            5384 B/op          3 allocs/op
BenchmarkGenerateRandomStringLength5-12           109804             10716 ns/op            5386 B/op          3 allocs/op
BenchmarkGenerateRandomStringLength6-12           109509             10719 ns/op            5392 B/op          3 allocs/op
*/

// Base on the benchmark results above => There's not much different when generate between string length
// Just use Length = 6 => there are 62 ^ 6 possible URLs

func TestDecodeID(t *testing.T) {
	num := uint64(rand.IntN(100000000))
	assert.Equal(t, num, DecodeID(EncodeID(num)))
}

func TestEncodeID(t *testing.T) {
	randStr := "abc1Az24e"
	assert.Equal(t, randStr, EncodeID(DecodeID(randStr)))
}

// Note that benchmark this way will create variety results, run about 4-5 times
// to see typical result
// Fix1: Because the result variety too much, I will use divide and conqueror range
func benchmarkEncodeID(b *testing.B, min int64, max int64) {
	var id string
	nums := make([]uint64, 1000)
	for i := range nums {
		nums[i] = uint64(rand.Int64N(max-min) + min)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		id = EncodeID(nums[i%1000])
	}
	runtime.KeepAlive(id)
}

// Number in [0, 10_000)
func BenchmarkEncodeIDWithSmallNum(b *testing.B) {
	benchmarkEncodeID(b, 0, 10_000)
}

// Number in [10_000, 1_000_000)
func BenchmarkEncodeIDWithMediumNum(b *testing.B) {
	benchmarkEncodeID(b, 10_000, 1_000_000)
}

// Number in [1_000_000, 1_000_000_000)
func BenchmarkEncodeIDWithBigNum(b *testing.B) {
	benchmarkEncodeID(b, 1_000_000, 1_000_000_000)
}

// Number in [1_000_000_000, 1_000_000_000_000)
func BenchmarkEncodeIDWithSuperBigNum(b *testing.B) {
	benchmarkEncodeID(b, 1_000_000_000, 1_000_000_000_000)
}

// Same problem with BenchmarkEncodeID
// Note: Already fixed
func benchmarkDecodeID(b *testing.B, len int) {
	var num uint64
	ids := make([]string, 1000)
	for i := range ids {
		ids[i] = RandomString(len)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		num = DecodeID(ids[i%1000])
	}
	runtime.KeepAlive(num)
}

func BenchmarkDecodeIDWithLengthEqual1(b *testing.B) {
	benchmarkDecodeID(b, 1)
}

func BenchmarkDecodeIDWithLengthEqual2(b *testing.B) {
	benchmarkDecodeID(b, 2)
}

func BenchmarkDecodeIDWithLengthEqual3(b *testing.B) {
	benchmarkDecodeID(b, 3)
}

func BenchmarkDecodeIDWithLengthEqual4(b *testing.B) {
	benchmarkDecodeID(b, 4)
}

func BenchmarkDecodeIDWithLengthEqual5(b *testing.B) {
	benchmarkDecodeID(b, 5)
}

func BenchmarkDecodeIDWithLengthEqual6(b *testing.B) {
	benchmarkDecodeID(b, 6)
}
