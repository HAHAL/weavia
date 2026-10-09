package platform

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
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
		StorageSigningKey: env("STORAGE_SIGNING_KEY", "weavia-development-only"),
	}
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
