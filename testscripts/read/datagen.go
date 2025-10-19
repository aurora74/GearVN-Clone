package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"math/rand"

	"github.com/go-faker/faker/v4"
)

type TestData struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type ReadCase struct {
	Key string `json:"key"`
}

func main() {
	const (
		totalKeys    = 10000
		readScenario = 200000
		zipfS        = 1.07
		zipfV        = 1.0
	)

	data := make([]TestData, totalKeys)
	for i := range totalKeys {
		data[i] = TestData{
			Key:   fmt.Sprintf("key_%d", i),
			Value: faker.URL(),
		}
	}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	zif := rand.NewZipf(r, zipfS, zipfV, uint64(totalKeys-1))

	readScenarioKeys := make([]ReadCase, readScenario)
	for i := range readScenarioKeys {
		index := int(zif.Uint64())
		readScenarioKeys[i] = ReadCase{Key: data[index].Key}
	}

	dataFile, err := os.OpenFile("data.json", os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		log.Fatal(err)
	}
	defer dataFile.Close()

	scenarioFile, err := os.OpenFile("read_scenario.json", os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		log.Fatal(err)
	}
	defer scenarioFile.Close()

	if err = json.NewEncoder(dataFile).Encode(data); err != nil {
		log.Fatal(err)
	}
	if err = json.NewEncoder(scenarioFile).Encode(readScenarioKeys); err != nil {
		log.Fatal(err)
	}
}
