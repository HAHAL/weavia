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
	"github.com/weavia/weavia/services/backend/internal/ops"
	"github.com/weavia/weavia/services/backend/internal/platform"
	"github.com/weavia/weavia/services/backend/internal/providerconfig"
	"github.com/weavia/weavia/services/backend/internal/providers"
	"github.com/weavia/weavia/services/backend/internal/routing"
	"github.com/weavia/weavia/services/backend/internal/routingadapter"
	"github.com/weavia/weavia/services/backend/internal/store"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
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
	credentials := providerconfig.New(pool, cfg.StorageSigningKey)
	routingService := routing.New(pool, credentials)
	mock := cfg.AIMode == "mock"
	var provider generation.Generator = &providers.Router{Computrix: &providers.AntDigital{BaseURL: cfg.ComputrixBaseURL, APIKey: cfg.ComputrixAPIKey, Timeout: cfg.ProviderTimeout}, AntDigital: &providers.AntDigital{BaseURL: cfg.AntDigitalBaseURL, APIKey: cfg.AntDigitalAPIKey, Timeout: cfg.ProviderTimeout}, DashScope: &providers.DashScope{BaseURL: cfg.DashScopeBaseURL, APIKey: cfg.DashScopeAPIKey, Model: cfg.DashScopeModel, Timeout: cfg.ProviderTimeout}, DashScopeEdit: &providers.DashScopeImageEdit{BaseURL: cfg.DashScopeImageEditBaseURL, APIKey: cfg.DashScopeAPIKey, Timeout: cfg.ProviderTimeout}, DashScopeVideo: &providers.DashScopeVideo{BaseURL: cfg.DashScopeBaseURL, APIKey: cfg.DashScopeAPIKey, Timeout: cfg.ProviderTimeout}, KeyLookup: credentials.Get}
	if mock {
		provider = &providers.Mock{Delay: 400 * time.Millisecond}
	}
	realEnabled := cfg.RealAIEnabled || mock
	opsService := ops.New(pool, "")
	service := generation.NewService(realEnabled, provider, nil, func(key string) (string, bool) { return storage.DataURL(key, mimeFor(key)) }, store.NewTaskRepository(pool)).WithCredits(commercial.New(pool)).WithRegistry(generation.PostgresRegistry{Pool: pool}).WithStorage(storage).WithMock(mock).WithRouting(routingadapter.New(routingService)).WithObserver(opsService)
	client, err := river.NewClient(riverpgxv5.New(pool), &river.Config{Queues: map[string]river.QueueConfig{jobs.Queue: {MaxWorkers: 4}}, Workers: jobs.Workers(service)})
	if err != nil {
		fatal(err)
	}
	if err = client.Start(ctx); err != nil {
		fatal(err)
	}
	go func() {
		heartbeat := time.NewTicker(30 * time.Second)
		cleanup := time.NewTicker(24 * time.Hour)
		defer heartbeat.Stop()
		defer cleanup.Stop()
		for {
			checkCtx, stop := context.WithTimeout(ctx, 5*time.Second)
			if err := opsService.Heartbeat(checkCtx); err != nil {
				slog.Warn("worker heartbeat failed", "error", err)
			}
			stop()
			select {
			case <-ctx.Done():
				return
			case <-heartbeat.C:
			case <-cleanup.C:
				cleanCtx, done := context.WithTimeout(ctx, 30*time.Second)
				if err := opsService.Cleanup(cleanCtx); err != nil {
					slog.Warn("task event cleanup failed", "error", err)
				}
				done()
			}
		}
	}()
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
