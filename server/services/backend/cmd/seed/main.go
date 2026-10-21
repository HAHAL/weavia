package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/platform"
)

func main() {
	cfg := platform.LoadConfig()
	if err := cfg.Validate(); err != nil {
		fatal(err)
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	defer pool.Close()

	email := env("DEV_USER_EMAIL", "dev@weavia.local")
	password := env("DEV_USER_PASSWORD", "weavia-dev-2026")
	hash, err := auth.HashPassword(password)
	if err != nil {
		fatal(err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		fatal(err)
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `INSERT INTO users(email,name,status) VALUES($1,'WEAVIA Dev','active') ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,status='active',updated_at=now() RETURNING id::text`, email).Scan(&userID)
	if err != nil {
		fatal(err)
	}

	var accountID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM accounts WHERE user_id=$1 AND provider='password'`, userID).Scan(&accountID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		_, err = tx.Exec(ctx, `INSERT INTO accounts(user_id,provider,provider_account_id,password_hash) VALUES($1,'password',$2,$3)`, userID, email, hash)
	case err == nil:
		_, err = tx.Exec(ctx, `UPDATE accounts SET provider_account_id=$2,password_hash=$3,updated_at=now() WHERE id=$1`, accountID, email, hash)
	}
	if err != nil {
		fatal(err)
	}

	_, err = tx.Exec(ctx, `INSERT INTO credit_accounts(user_id,available_balance,reserved_balance,currency) VALUES($1,1000,0,'credits') ON CONFLICT(user_id,currency) DO UPDATE SET available_balance=GREATEST(credit_accounts.available_balance,1000),updated_at=now()`, userID)
	if err != nil {
		fatal(err)
	}

	_, err = tx.Exec(ctx, `INSERT INTO subscriptions(user_id,plan_id,status,current_period_start) SELECT $1,id,'active',now() FROM plans WHERE code='free' AND NOT EXISTS(SELECT 1 FROM subscriptions WHERE user_id=$1 AND status IN('active','trialing'))`, userID)
	if err != nil {
		fatal(err)
	}

	_, err = tx.Exec(ctx, `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='super_admin' ON CONFLICT DO NOTHING`, userID)
	if err != nil {
		fatal(err)
	}

	if err = tx.Commit(ctx); err != nil {
		fatal(err)
	}
	fmt.Printf("dev user ready: %s / %s (credits: 1000)\n", email, password)
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func fatal(err error) { slog.Error("seed failed", "error", err); os.Exit(1) }
