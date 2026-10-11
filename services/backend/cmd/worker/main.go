package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/commercial"
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/jobs"
	"github.com/weavia/weavia/services/backend/internal/platform"
	"github.com/weavia/weavia/services/backend/internal/providers"
	"github.com/weavia/weavia/services/backend/internal/store"
)

func main() {
	cfg := platform.LoadConfig()
	if err := cfg.Validate(); err != nil {
		fatal(err)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	defer pool.Close()
	if err = pool.Ping(ctx); err != nil {
		fatal(err)
	}
	storage := assets.New(cfg.AssetStorageDir, cfg.StorageSigningKey)
	provider := &providers.Router{AntDigital: &providers.AntDigital{BaseURL: cfg.AntDigitalBaseURL, APIKey: cfg.AntDigitalAPIKey, Timeout: cfg.ProviderTimeout}, DashScope: &providers.DashScope{BaseURL: cfg.DashScopeBaseURL, APIKey: cfg.DashScopeAPIKey, Model: cfg.DashScopeModel, Timeout: cfg.ProviderTimeout}}
	service := generation.NewService(cfg.RealAIEnabled, provider, nil, func(key string) (string, bool) { return storage.DataURL(key, mimeFor(key)) }, store.NewTaskRepository(pool)).WithCredits(commercial.New(pool)).WithRegistry(generation.PostgresRegistry{Pool: pool})
	client, err := river.NewClient(riverpgxv5.New(pool), &river.Config{Queues: map[string]river.QueueConfig{jobs.Queue: {MaxWorkers: 4}}, Workers: jobs.Workers(service)})
	if err != nil {
		fatal(err)
	}
	if err = client.Start(ctx); err != nil {
		fatal(err)
	}
	slog.Info("WEAVIA worker started", "queue", jobs.Queue, "real_ai_enabled", cfg.RealAIEnabled)
	<-ctx.Done()
	stopCtx, stop := context.WithTimeout(context.Background(), 20*time.Second)
	defer stop()
	if err = client.Stop(stopCtx); err != nil {
		slog.Error("worker shutdown failed", "error", err)
	}
}
func fatal(err error) { slog.Error("worker failed", "error", err); os.Exit(1) }
func mimeFor(key string) string {
	if len(key) >= 5 && key[len(key)-5:] == ".webp" {
		return "image/webp"
	}
	if len(key) >= 4 && key[len(key)-4:] == ".jpg" {
		return "image/jpeg"
	}
	return "image/png"
}
