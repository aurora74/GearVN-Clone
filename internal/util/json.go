package util

// This file contains related things need to deal with when implementing request handler
// Currently only encodejson and decodejson

import (
	"encoding/json"
	"errors"
	"net/http"
)

// EncodeJSON writes the given data as JSON to the provided http.ResponseWriter.
// If there is an error encoding the data, a 500 Internal Server Error response is written to the ResponseWriter.
func EncodeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// DecodeJSON reads the request body as JSON and decodes it into the provided form interface.
// If the request Content-Type header is not "application/json", it returns ErrNotMatchContentTypeJSON.
// If there is an error decoding the JSON, it returns the error.
func DecodeJSON(r *http.Request, form interface{}) error {
	if r.Header.Get("Content-Type") != "application/json" {
		return ErrNotMatchContentTypeJSON
	}

	if err := json.NewDecoder(r.Body).Decode(&form); err != nil {
		return err
	}

	return nil
}

var ErrNotMatchContentTypeJSON = errors.New("content type must be 'application/json'")
