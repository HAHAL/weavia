// Package storageconfig 管理对象存储配置，并在保存后热切换后端存储。
package storageconfig

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Config struct {
	Provider         string     `json:"provider"`
	Bucket           string     `json:"bucket"`
	Region           string     `json:"region"`
	EndpointInternal string     `json:"endpointInternal"`
	EndpointPublic   string     `json:"endpointPublic"`
	Prefix           string     `json:"prefix"`
	AccessKeyID      string     `json:"accessKeyId"`
	HasSecret        bool       `json:"hasSecret"`
	VerifiedAt       *time.Time `json:"verifiedAt"`
	LastError        string     `json:"lastError"`
}

type Input struct {
	Provider         string `json:"provider"`
	Bucket           string `json:"bucket"`
	Region           string `json:"region"`
	EndpointInternal string `json:"endpointInternal"`
	EndpointPublic   string `json:"endpointPublic"`
	Prefix           string `json:"prefix"`
	AccessKeyID      string `json:"accessKeyId"`
	AccessKeySecret  string `json:"accessKeySecret"`
}

type Service struct {
	pool   *pgxpool.Pool
	secret []byte
}

func New(pool *pgxpool.Pool, signingKey string) *Service {
	sum := sha256.Sum256([]byte("weavia-storage:" + signingKey))
	return &Service{pool: pool, secret: sum[:]}
}

func (s *Service) Load(ctx context.Context) (Config, string, error) {
	var cfg Config
	var encrypted []byte
	err := s.pool.QueryRow(ctx, `SELECT provider, bucket, region, endpoint_internal, endpoint_public, prefix, access_key_id, access_key_secret_enc, verified_at, last_error FROM storage_settings WHERE id=true`).
		Scan(&cfg.Provider, &cfg.Bucket, &cfg.Region, &cfg.EndpointInternal, &cfg.EndpointPublic, &cfg.Prefix, &cfg.AccessKeyID, &encrypted, &cfg.VerifiedAt, &cfg.LastError)
	if err != nil {
		return Config{}, "", err
	}
	cfg.HasSecret = len(encrypted) > 0
	secret := ""
	if len(encrypted) > 0 {
		secret, err = s.decrypt(encrypted)
		if err != nil {
			return Config{}, "", err
		}
	}
	return cfg, secret, nil
}

func (s *Service) Save(ctx context.Context, in Input) (Config, error) {
	provider := strings.TrimSpace(in.Provider)
	if provider != "local" && provider != "oss" {
		return Config{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "存储类型只支持 local / oss", Status: 400}
	}
	if provider == "oss" {
		if strings.TrimSpace(in.Bucket) == "" || strings.TrimSpace(in.EndpointInternal) == "" || strings.TrimSpace(in.AccessKeyID) == "" {
			return Config{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "启用 OSS 需要填写 Bucket、内网 Endpoint 和 AccessKeyId", Status: 400}
		}
	}
	var encrypted []byte
	if strings.TrimSpace(in.AccessKeySecret) != "" {
		value, err := s.encrypt(strings.TrimSpace(in.AccessKeySecret))
		if err != nil {
			return Config{}, err
		}
		encrypted = value
	}
	_, err := s.pool.Exec(ctx, `UPDATE storage_settings SET provider=$1, bucket=$2, region=$3, endpoint_internal=$4, endpoint_public=$5, prefix=$6, access_key_id=$7,
		access_key_secret_enc=COALESCE($8, access_key_secret_enc), updated_at=now() WHERE id=true`,
		provider, strings.TrimSpace(in.Bucket), strings.TrimSpace(in.Region), strings.TrimSpace(in.EndpointInternal), strings.TrimSpace(in.EndpointPublic), strings.Trim(strings.TrimSpace(in.Prefix), "/"), strings.TrimSpace(in.AccessKeyID), encrypted)
	if err != nil {
		return Config{}, err
	}
	cfg, _, err := s.Load(ctx)
	return cfg, err
}

// Apply 按当前配置切换 assets.Storage 的后端。
func (s *Service) Apply(ctx context.Context, storage *assets.Storage) error {
	cfg, secret, err := s.Load(ctx)
	if err != nil {
		return err
	}
	if cfg.Provider != "oss" || secret == "" {
		storage.UseBlob(nil)
		return nil
	}
	endpoint := cfg.EndpointInternal
	if endpoint == "" {
		endpoint = cfg.EndpointPublic
	}
	blob, err := assets.NewOSS(assets.OSSConfig{Endpoint: endpoint, Bucket: cfg.Bucket, KeyID: cfg.AccessKeyID, Secret: secret, Prefix: cfg.Prefix})
	if err != nil {
		return err
	}
	storage.UseBlob(blob)
	return nil
}

// Test 用已保存的配置做一次写入、读取、删除探针。
func (s *Service) Test(ctx context.Context) (Config, error) {
	cfg, secret, err := s.Load(ctx)
	if err != nil {
		return cfg, err
	}
	if cfg.Provider != "oss" {
		return cfg, &generation.APIError{Code: "INVALID_REQUEST", Message: "当前使用本地磁盘，无需测试 OSS", Status: 400}
	}
	endpoint := cfg.EndpointInternal
	if endpoint == "" {
		endpoint = cfg.EndpointPublic
	}
	blob, err := assets.NewOSS(assets.OSSConfig{Endpoint: endpoint, Bucket: cfg.Bucket, KeyID: cfg.AccessKeyID, Secret: secret, Prefix: cfg.Prefix})
	if err != nil {
		s.recordTest(ctx, err)
		return cfg, err
	}
	if err := blob.Health(ctx); err != nil {
		s.recordTest(ctx, err)
		return cfg, err
	}
	probeKey := "health/probe.txt"
	if err := blob.Put(ctx, probeKey, []byte("ok"), "text/plain"); err != nil {
		s.recordTest(ctx, err)
		return cfg, err
	}
	reader, _, err := blob.Get(ctx, probeKey)
	if err == nil {
		reader.Close()
	}
	_ = blob.Delete(ctx, probeKey)
	if err != nil {
		s.recordTest(ctx, err)
		return cfg, err
	}
	s.recordTest(ctx, nil)
	cfg, _, _ = s.Load(ctx)
	return cfg, nil
}

func (s *Service) recordTest(ctx context.Context, testErr error) {
	message := ""
	if testErr != nil {
		message = testErr.Error()
	}
	_, _ = s.pool.Exec(ctx, `UPDATE storage_settings SET verified_at=CASE WHEN $1='' THEN now() ELSE verified_at END, last_error=$1, updated_at=now() WHERE id=true`, message)
}

func (s *Service) encrypt(plain string) ([]byte, error) {
	block, err := aes.NewCipher(s.secret)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, []byte(plain), nil), nil
}

func (s *Service) decrypt(value []byte) (string, error) {
	block, err := aes.NewCipher(s.secret)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(value) < gcm.NonceSize() {
		return "", errors.New("invalid stored secret")
	}
	plain, err := gcm.Open(nil, value[:gcm.NonceSize()], value[gcm.NonceSize():], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
