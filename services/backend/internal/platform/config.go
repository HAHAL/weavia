package platform

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv            string
	DemoMode          bool
	Address           string
	DatabaseURL       string
	WebOrigin         string
	AntDigitalBaseURL string
	AntDigitalAPIKey  string
	DashScopeBaseURL  string
	DashScopeAPIKey   string
	DashScopeModel    string
	ProviderTimeout   time.Duration
	RealAIEnabled     bool
	AssetStorageDir   string
	StorageSigningKey string
}

func LoadConfig() Config {
	return Config{
		AppEnv:            env("APP_ENV", "development"),
		DemoMode:          os.Getenv("DEMO_MODE") == "true",
		Address:           env("BACKEND_ADDR", ":8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		WebOrigin:         env("WEAVIA_WEB_ORIGIN", "http://localhost:3000"),
		AntDigitalBaseURL: env("ANTDIGITAL_BASE_URL", "https://maas-api.antdigital.com/v1"),
		AntDigitalAPIKey:  os.Getenv("ANTDIGITAL_API_KEY"),
		DashScopeBaseURL:  env("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/api/v1"),
		DashScopeAPIKey:   os.Getenv("DASHSCOPE_API_KEY"),
		DashScopeModel:    env("DASHSCOPE_IMAGE_EDIT_MODEL", "qwen-image-edit-plus"),
		ProviderTimeout:   time.Duration(envInt("AI_PROVIDER_TIMEOUT_MS", 120000)) * time.Millisecond,
		RealAIEnabled:     os.Getenv("ENABLE_REAL_AI") == "true",
		AssetStorageDir:   env("ASSET_STORAGE_DIR", "./var/assets"),
		StorageSigningKey: os.Getenv("STORAGE_SIGNING_KEY"),
	}
}
func (c Config) Validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.StorageSigningKey == "" { return fmt.Errorf("STORAGE_SIGNING_KEY is required") }
	if c.DemoMode && c.AppEnv != "test" {
		return fmt.Errorf("DEMO_MODE is allowed only with APP_ENV=test")
	}
	if c.AppEnv != "production" {
		return nil
	}
	if c.DemoMode {
		return fmt.Errorf("DEMO_MODE cannot be enabled in production")
	}
	if c.StorageSigningKey == "" || c.StorageSigningKey == "weavia-development-only" || strings.HasPrefix(c.StorageSigningKey, "change-me") {
		return fmt.Errorf("strong STORAGE_SIGNING_KEY is required")
	}
	if !strings.HasPrefix(c.WebOrigin, "https://") {
		return fmt.Errorf("WEAVIA_WEB_ORIGIN must use HTTPS")
	}
	if strings.Contains(c.DatabaseURL, "weavia:weavia@") || strings.Contains(c.DatabaseURL, "sslmode=disable") {
		return fmt.Errorf("production DATABASE_URL uses development credentials or insecure transport")
	}
	if c.RealAIEnabled && c.AntDigitalAPIKey == "" && c.DashScopeAPIKey == "" {
		return fmt.Errorf("ENABLE_REAL_AI requires a provider key")
	}
	return nil
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}
