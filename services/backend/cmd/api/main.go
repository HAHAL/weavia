package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/commercial"
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/httpapi"
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
	repository := store.NewTaskRepository(pool)
	if cfg.DemoMode {
		if err = repository.EnsureDemoUser(ctx); err != nil {
			fatal(err)
		}
	}
	riverClient, err := river.NewClient(riverpgxv5.New(pool), &river.Config{})
	if err != nil {
		fatal(err)
	}
	storage := assets.New(cfg.AssetStorageDir, cfg.StorageSigningKey)
	provider := &providers.Router{AntDigital: &providers.AntDigital{BaseURL: cfg.AntDigitalBaseURL, APIKey: cfg.AntDigitalAPIKey, Timeout: cfg.ProviderTimeout}, DashScope: &providers.DashScope{BaseURL: cfg.DashScopeBaseURL, APIKey: cfg.DashScopeAPIKey, Model: cfg.DashScopeModel, Timeout: cfg.ProviderTimeout}}
	commercialService := commercial.New(pool)
	service := generation.NewService(cfg.RealAIEnabled, provider, jobs.Enqueuer{Client: riverClient}, func(key string) (string, bool) { return storage.DataURL(key, mimeFor(key)) }, repository).WithCredits(commercialService).WithRegistry(generation.PostgresRegistry{Pool: pool})
	api := &httpapi.Server{Auth: auth.NewService(pool, cfg.WebOrigin, cfg.DemoMode), Commercial: commercialService, Generation: service, Assets: storage, AntDigitalConfigured: cfg.AntDigitalAPIKey != "", DashScopeConfigured: cfg.DashScopeAPIKey != "", RealAIEnabled: cfg.RealAIEnabled, AntDigitalBaseURL: cfg.AntDigitalBaseURL, DashScopeBaseURL: cfg.DashScopeBaseURL, Readiness: map[string]func(context.Context) error{
		"database": pool.Ping,
		"queue": func(ctx context.Context) error {
			var exists bool
			return pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM river_job LIMIT 1)`).Scan(&exists)
		},
		"storage": storage.Check,
	}}
	server := &http.Server{Addr: cfg.Address, Handler: api.Router(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, stop := context.WithTimeout(context.Background(), 15*time.Second)
		defer stop()
		_ = server.Shutdown(shutdownCtx)
	}()
	slog.Info("WEAVIA Go API listening", "address", cfg.Address, "real_ai_enabled", cfg.RealAIEnabled)
	if err = server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fatal(err)
	}
}
func fatal(err error) { slog.Error("startup failed", "error", err); os.Exit(1) }
func mimeFor(key string) string {
	if len(key) >= 5 && key[len(key)-5:] == ".webp" {
		return "image/webp"
	}
	if len(key) >= 4 && (key[len(key)-4:] == ".jpg" || key[len(key)-4:] == "jpeg") {
		return "image/jpeg"
	}
	return "image/png"
}
