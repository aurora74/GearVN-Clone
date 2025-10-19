package idgen

import (
	"context"
	"log/slog"
	"sync"

	"github.com/armistcxy/shorten/internal/background"
	"github.com/armistcxy/shorten/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jmoiron/sqlx"
	"github.com/riverqueue/river"
)

// Backed by PostgreSQL
type SeqIDGenerator struct {
	shards  []ShardIDManager
	current uint64
	db      *sqlx.DB
	rc      *river.Client[pgx.Tx]
	mu      sync.Mutex
}

const SHARD_SIZE = 1 << 25

func NewSeqIDGenerator(db *sqlx.DB, start uint64, numberOfShards int, rc *river.Client[pgx.Tx]) *SeqIDGenerator {
	shards := make([]ShardIDManager, numberOfShards)
	var (
		lID     uint64 = 0
		current uint64 = 1
	)
	for i := 0; i < numberOfShards; i++ {
		for {
			lID = findLastUsedID(db, current, SHARD_SIZE)
			if lID == 0 { // no id in given range been used yet
				lID = current - 1
			}
			if lID != current+SHARD_SIZE-1 {
				break
			}
			current += SHARD_SIZE
		}

		shards[i] = NewShardIDManager(current, current+SHARD_SIZE-1, lID)
		current += SHARD_SIZE
	}

	return &SeqIDGenerator{
		shards:  shards,
		current: current,
		db:      db,
		rc:      rc,
		mu:      sync.Mutex{},
	}
}
func findLastUsedID(db *sqlx.DB, start uint64, shardSize uint64) uint64 {
	// This is a littlbe bit tricky
	// COALESCE(MAX(id), 0) will substitute 0 if MAX(id) is NULL, ensuring the query always returns a value
	// If the query returns 0, that mean there no id in that range already been used.
	query := `SELECT COALESCE(MAX(id), 0) FROM ids WHERE id >= $1 and id < $2`
	var lastUsed uint64
	if err := db.Get(&lastUsed, query, start, start+shardSize); err != nil {
		slog.Error("failed when sending find last used id query to database", "error", err.Error())
		// return maximize in that range in case error occur
		return start + shardSize - 1
	}

	return lastUsed
}

func (sg *SeqIDGenerator) GenerateID() string {
	// i think associate with channel here might be a better idea => could improve later
	// current implement: using sharded mutex and iterate over shard to determine whether
	// we can perform lock on that mutex and yield an id from that range("TryLock")
	for {
		for i := range sg.shards {
			if sg.shards[i].mu.TryLock() {
				sg.shards[i].cur++
				idIntForm := sg.shards[i].cur
				if sg.shards[i].cur > sg.shards[i].end {
					// give new range to shard[i]
					sg.mu.Lock()
					var lID uint64
					for {
						lID = findLastUsedID(sg.db, sg.current, SHARD_SIZE)
						if lID != sg.current+SHARD_SIZE-1 {
							break
						}
						sg.current += SHARD_SIZE
					}
					sg.mu.Unlock()
					_, err := sg.rc.Insert(context.Background(), background.AddLastUsedIDArgs{
						LastUsedID: sg.shards[i].end,
					}, nil)
					if err != nil {
						slog.Error("failed to enqueue job", "error", err.Error())
					}
					sg.shards[i] = NewShardIDManager(sg.current-SHARD_SIZE, sg.current-1, lID)
					break
				}
				sg.shards[i].mu.Unlock()
				return domain.EncodeID(idIntForm)
			}
		}
	}

}

func (sg *SeqIDGenerator) RetriveLastUsedIds() []uint64 {
	ids := make([]uint64, len(sg.shards))
	for i := range ids {
		if sg.shards[i].cur < sg.shards[i].start {
			ids[i] = uint64(0) // no update
		} else {
			ids[i] = sg.shards[i].cur
		}
	}
	return ids
}

type ShardIDManager struct {
	mu    sync.Mutex
	start uint64
	end   uint64
	cur   uint64
}

func NewShardIDManager(start, end, cur uint64) ShardIDManager {
	return ShardIDManager{
		mu:    sync.Mutex{},
		start: start,
		end:   end,
		cur:   cur,
	}
}
