package main

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jmoiron/sqlx"
)

var (
	markFraudQuery   = "UPDATE urls SET fraud=true WHERE id=$1"
	markFraudTimeout = 10 * time.Second
)

func markURLAsFraud(db *sqlx.DB, id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), markFraudTimeout)
	defer cancel()

	result, err := db.ExecContext(ctx, markFraudQuery, id)
	if err != nil {
		slog.Error("failed when executing mark fraud url query", "error", err.Error())
		return err
	}

	affectedAmount, err := result.RowsAffected()
	if err != nil {
		slog.Error("failed to retrieve number of rows affected after executing mark fraud url query", "error", err.Error())
		return err
	}

	if affectedAmount != 1 {
		slog.Error("number of affected rows after mark fraud url must be 1", "number of affected rows", affectedAmount)
		return errors.New("number of affected rows after mark fraud url is not 1")
	}

	return nil
}
