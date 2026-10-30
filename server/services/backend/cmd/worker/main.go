package main

import (
	"context"
	"github.com/weavia/weavia/services/backend/internal/storageconfig"
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
	"github.com/weavia/weavia/services/backend/internal/ops"
	"github.com/weavia/weavia/services/backend/internal/platform"
	"github.com/weavia/weavia/services/backend/internal/providerconfig"
	"github.com/weavia/weavia/services/backend/internal/providers"
	"github.com/weavia/weavia/services/backend/internal/routing"
	"github.com/weavia/weavia/services/backend/internal/routingadapter"
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
	// The API writes references to object storage when OSS is enabled, so the
	// worker must use the same storage or every reference image looks missing.
	if err := storageconfig.New(pool, cfg.StorageSigningKey).Apply(ctx, storage); err != nil {
		slog.Warn("object storage config not applied, worker reads local disk only", "error", err)
	}
	slog.Info("worker storage", "object_storage", storage.BlobEnabled())
	credentials := providerconfig.New(pool, cfg.StorageSigningKey)
	routingService := routing.New(pool, credentials)
	mock := cfg.AIMode == "mock"
	var provider generation.Generator = &providers.Router{Computrix: &providers.AntDigital{BaseURL: cfg.ComputrixBaseURL, APIKey: cfg.ComputrixAPIKey, Timeout: cfg.ProviderTimeout}, AntDigital: &providers.AntDigital{BaseURL: cfg.AntDigitalBaseURL, APIKey: cfg.AntDigitalAPIKey, Timeout: cfg.ProviderTimeout}, DashScope: &providers.DashScope{BaseURL: cfg.DashScopeBaseURL, APIKey: cfg.DashScopeAPIKey, Model: cfg.DashScopeModel, Timeout: cfg.ProviderTimeout}, DashScopeEdit: &providers.DashScopeImageEdit{BaseURL: cfg.DashScopeImageEditBaseURL, APIKey: cfg.DashScopeAPIKey, Timeout: cfg.ProviderTimeout}, DashScopeVideo: &providers.DashScopeVideo{BaseURL: cfg.DashScopeBaseURL, APIKey: cfg.DashScopeAPIKey, Timeout: cfg.ProviderTimeout}, KeyLookup: credentials.Get}
	if mock {
		provider = &providers.Mock{Delay: 400 * time.Millisecond}
	}
	realEnabled := cfg.RealAIEnabled || mock
	opsService := ops.New(pool, "")
	service := generation.NewService(realEnabled, provider, nil, func(key string) (string, bool) { return storage.DataURL(key, mimeFor(key)) }, store.NewTaskRepository(pool)).WithCredits(commercial.New(pool)).WithRegistry(generation.PostgresRegistry{Pool: pool}).WithStorage(storage).WithMock(mock).WithRouting(routingadapter.New(routingService))
	service.WithEvents(opsService.Record)
	client, err := river.NewClient(riverpgxv5.New(pool), &river.Config{Queues: map[string]river.QueueConfig{jobs.Queue: {MaxWorkers: 4}}, Workers: jobs.Workers(service)})
	if err != nil {
		fatal(err)
	}
	if err = client.Start(ctx); err != nil {
		fatal(err)
	}
	if os.Getenv("VIDEO_RECONCILE_ENABLED") == "true" {
		go func() {
			service.ResumeVideoTasks(ctx)
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					service.ResumeVideoTasks(ctx)
				}
			}
		}()
	}
	go func() {
		// The admin console reads worker_heartbeats to tell a dead worker from a
		// quiet one; without it the ops page shows the worker as down.
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			beatCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			if err := opsService.Heartbeat(beatCtx); err != nil {
				slog.Warn("worker heartbeat failed", "error", err)
			}
			cancel()
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	slog.Info("WEAVIA worker started", "queue", jobs.Queue, "ai_mode", cfg.AIMode, "real_ai_enabled", realEnabled)
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
