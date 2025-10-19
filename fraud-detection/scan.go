package main

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/tidwall/gjson"
)

var (
	virusTotalScanURL = "https://www.virustotal.com/api/v3/urls"
)

func scanURL(url string) (bool, error) {
	apiKey := os.Getenv("VIRUSTOTAL_API_KEY")

	payload := strings.NewReader(fmt.Sprintf("url=%s", url))

	req, err := http.NewRequest("POST", virusTotalScanURL, payload)
	if err != nil {
		slog.Error("failed to create request", "error", err.Error())
		return false, err
	}

	req.Header.Add("accept", "application/json")
	req.Header.Add("content-type", "application/x-www-form-urlencoded")
	req.Header.Add("x-apikey", apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Error("failed to request for creating analysis", "error", err.Error())
		return false, err
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, err
	}

	resp.Body.Close()

	analysisURL := gjson.Get(string(body), "data.links.self")

	req, err = http.NewRequest("GET", analysisURL.Str, nil)
	if err != nil {
		slog.Error("failed to request for creating analysis", "error", err.Error())
		return false, err
	}

	req.Header.Add("accept", "application/json")
	req.Header.Add("x-apikey", apiKey)

	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}

	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return false, err
	}

	maliciousCountResult := gjson.Get(string(body), "data.attributes.stats.malicious")
	if !maliciousCountResult.Exists() {
		return false, errors.New("lack of malicious stat")
	}

	suspiciousCountResult := gjson.Get(string(body), "data.attributes.stats.suspicious")
	if !suspiciousCountResult.Exists() {
		return false, errors.New("lack of suspicious stat")
	}

	// Condition to check whether an URL is fraud
	if maliciousCountResult.Num >= 1 || suspiciousCountResult.Num >= 4 {
		return true, nil
	}

	return false, nil
}
