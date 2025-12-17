package repository

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"strconv"
	"sync"
	"testing"

	"github.com/armistcxy/shorten/internal/domain"
	"github.com/go-faker/faker/v4"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
)

var (
	once sync.Once
	db   *sqlx.DB
	repo *PostgresURLRepository
)

func TestCreate(t *testing.T) {
	repo, db = getSystem()
	if db == nil {
		t.Error("db is nil")
		return
	}

	if repo == nil {
		t.Error("repo is nil")
		return
	}

	id := "abcdef"
	origin := "https://example.com/abcqwertyuio123456789qwertyuiop"

	defer clear(db, []string{id})
	shorten, err := repo.Create(context.Background(), id, origin)
	if err != nil {
		t.Errorf("failed to create: %s", err)
		return
	}

	assert.Equal(t, id, shorten.ID)
	assert.Equal(t, origin, shorten.Origin)
}

func TestGet(t *testing.T) {
	repo, db = getSystem()
	id := "abcdef"
	origin := "https://example.com/abcqwertyuio123456789qwertyuiop"
	_, err := repo.Create(context.Background(), id, origin)
	if err != nil {
		t.Error(err.Error())
		t.FailNow()
	}
	defer clear(db, []string{id})
	result, err := repo.Get(context.Background(), id)
	if err != nil {
		t.Errorf("failed to get origin: %s", err)
		return
	}
	assert.Equal(t, origin, result)
}

func TestRetrieveFraud(t *testing.T) {
	repo, db = getSystem()
	id := "abcdef"
	origin := "https://example.com/abcqwertyuio123456789qwertyuiop"
	_, err := repo.Create(context.Background(), id, origin)
	if err != nil {
		t.Error(err.Error())
		t.FailNow()
	}
	defer clear(db, []string{id})

	fraud, err := repo.RetrieveFraud(context.Background(), id)
	if err != nil {
		t.Errorf("failed to retrieve fraud: %s", err)
		return
	}

	assert.Equal(t, false, fraud)
}

func TestGetView(t *testing.T) {
	repo, db = getSystem()
	id := "abcdef"
	origin := "https://example.com/abcqwertyuio123456789qwertyuiop"
	_, err := repo.Create(context.Background(), id, origin)
	if err != nil {
		t.Error(err.Error())
		t.FailNow()
	}
	defer clear(db, []string{id})
	view, err := repo.GetView(context.Background(), id)
	if err != nil {
		t.Errorf("failed to get view: %s", err)
		return
	}
	assert.Equal(t, 0, view)
}

func TestBatchCreate(t *testing.T) {
	repo, db = getSystem()
	ids := []string{"abcdef", "fwerwe", "le123f"}
	origins := []string{"https://example.com/abcqwertyuio123456789qwertyuiop", "https://example1.com/231231231231231221312312", "https://example2.com/afsdfaewrr"}
	defer clear(db, ids)
	inputs := make([]domain.CreateInput, len(ids))
	for i := range inputs {
		inputs[i] = domain.CreateInput{
			ID:  ids[i],
			URL: origins[i],
		}
	}
	err := repo.BatchCreate(context.Background(), inputs)
	if err != nil {
		t.Error(err.Error())
		t.FailNow()
	}
}

func prepareInstances(numberOfInstances int) []domain.CreateInput {
	inputs := make([]domain.CreateInput, numberOfInstances)
	for i := range inputs {
		inputs[i] = domain.CreateInput{
			ID:  strconv.Itoa(i),
			URL: faker.URL(),
		}
	}
	return inputs
}

func benchmarkCreate(b *testing.B, numberOfInstances int) {
	repo, db = getSystem()
	inputs := prepareInstances(numberOfInstances)
	ids := make([]string, numberOfInstances)
	for i := range ids {
		ids[i] = inputs[i].ID
	}
	var shorten *domain.ShortURL
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		b.StartTimer()
		for i := range inputs {
			shorten, _ = repo.Create(context.Background(), inputs[i].ID, inputs[i].URL)
		}
		b.StopTimer()
		clear(db, ids)
	}
	runtime.KeepAlive(shorten)
}

func BenchmarkCreate100Instances(b *testing.B) {
	benchmarkCreate(b, 100)
}

func BenchmarkCreate1000Instances(b *testing.B) {
	benchmarkCreate(b, 1_000)
}

func BenchmarkCreate2000Instances(b *testing.B) {
	benchmarkCreate(b, 2_000)
}

func BenchmarkGet(b *testing.B) {}

func BenchmarkRetrieveFraud(b *testing.B) {}

func BenchmarkGetView(b *testing.B) {}

func benchmarkBatchCreate(b *testing.B, numberOfInstances int) {
	repo, db = getSystem()
	inputs := prepareInstances(numberOfInstances)
	ids := make([]string, numberOfInstances)
	for i := range ids {
		ids[i] = inputs[i].ID
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		b.StartTimer()
		_ = repo.BatchCreate(context.Background(), inputs)
		b.StopTimer()
		clear(db, ids)
	}
}

func BenchmarkBatchCreate100Instances(b *testing.B) {
	benchmarkBatchCreate(b, 100)
}

func BenchmarkBatchCreate1000Instances(b *testing.B) {
	benchmarkBatchCreate(b, 1_000)
}

func BenchmarkBatchCreate2000Instances(b *testing.B) {
	benchmarkBatchCreate(b, 2_000)
}

func initSystem() {
	db = sqlx.MustConnect("postgres", os.Getenv("URL_DSN"))
	pool, _ := pgxpool.New(context.Background(), os.Getenv("URL_DSN"))
	var err error
	repo, err = NewPostgresURLRepository(db, pool)
	if err != nil {
		panic(err)
	}
}

func getSystem() (*PostgresURLRepository, *sqlx.DB) {
	once.Do(initSystem)
	return repo, db
}

func clear(db *sqlx.DB, ids []string) {
	if len(ids) == 0 {
		return
	}
	var (
		deleteQuery = `
			DELETE FROM urls
			WHERE id IN ( 
		`
	)

	byteBuffer := bytes.NewBufferString(deleteQuery)
	for i := range ids {
		byteBuffer.WriteString(fmt.Sprintf("'%s'", ids[i]))
		if i < len(ids)-1 {
			byteBuffer.WriteString(",")
		}
	}
	byteBuffer.WriteString(")")

	if _, err := db.Exec(byteBuffer.String()); err != nil {
		slog.Error("failed to delete fixtures after test", "error", err.Error())
	}
}
