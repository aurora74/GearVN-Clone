package idgen

import (
	"sync"
	"testing"
)

func BenchmarkRandomGenerateID(b *testing.B) {
	var (
		numberOfYieldIDs int                = 500
		numberOfWorkers  int                = 2000
		wg                                  = sync.WaitGroup{}
		rg               *RandomIDGenerator = NewRandomIDGenerator()
	)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for range numberOfWorkers {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for range numberOfYieldIDs {
					rg.GenerateID()
				}
			}()
		}

		wg.Wait()
	}
}
