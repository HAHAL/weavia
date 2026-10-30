package providerconfig

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Status struct {
	Configured bool       `json:"configured"`
	Last4      string     `json:"keyLast4,omitempty"`
	UpdatedAt  *time.Time `json:"updatedAt,omitempty"`
}

type Service struct {
	pool   *pgxpool.Pool
	secret []byte
}

func New(pool *pgxpool.Pool, signingKey string) *Service {
	sum := sha256.Sum256([]byte("weavia-provider-credentials:" + signingKey))
	return &Service{pool: pool, secret: sum[:]}
}

func (s *Service) Set(ctx context.Context, providerCode, apiKey, userID string) error {
	code := strings.ToLower(strings.TrimSpace(providerCode))
	if code != "antdigital" && code != "dashscope" && code != "computrix" {
		return &generation.APIError{Code: "INVALID_PROVIDER", Message: "不支持的 Provider", Status: 400}
	}
	key := strings.TrimSpace(apiKey)
	if len(key) < 16 || len(key) > 512 || strings.ContainsAny(key, "\r\n") {
		return &generation.APIError{Code: "INVALID_KEY", Message: "Provider Key 格式无效", Status: 400}
	}
	sealed, err := s.encrypt(key)
	if err != nil {
		return err
	}
	last4 := key
	if len(last4) > 4 {
		last4 = last4[len(last4)-4:]
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO provider_credentials(provider_code,encrypted_key,key_last4,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(provider_code) DO UPDATE SET encrypted_key=EXCLUDED.encrypted_key,key_last4=EXCLUDED.key_last4,updated_by=EXCLUDED.updated_by,updated_at=now()`, code, sealed, last4, userID)
	return err
}

func (s *Service) Get(ctx context.Context, providerCode string) (string, error) {
	var sealed []byte
	err := s.pool.QueryRow(ctx, `SELECT encrypted_key FROM provider_credentials WHERE provider_code=$1`, strings.ToLower(strings.TrimSpace(providerCode))).Scan(&sealed)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return s.decrypt(sealed)
}

func (s *Service) SetChannelKey(ctx context.Context, channelID, apiKey, userID string) error {
	key := strings.TrimSpace(apiKey)
	if len(key) < 16 || len(key) > 512 || strings.ContainsAny(key, "\r\n") {
		return &generation.APIError{Code: "INVALID_KEY", Message: "Provider Key 格式无效", Status: 400}
	}
	sealed, err := s.encrypt(key)
	if err != nil {
		return err
	}
	last4 := key
	if len(last4) > 4 {
		last4 = last4[len(last4)-4:]
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO channel_keys(channel_id,encrypted_key,key_last4,updated_by) VALUES($1,$2,$3,$4)`, channelID, sealed, last4, userID)
	return err
}

func (s *Service) GetChannelKey(ctx context.Context, channelID string) (string, error) {
	key, _, err := s.GetChannelKeyWithID(ctx, channelID)
	return key, err
}

// GetChannelKeyWithID 同时返回 Key 的 ID，便于调用日志按 Key 归因。
func (s *Service) GetChannelKeyWithID(ctx context.Context, channelID string) (string, string, error) {
	var id string
	var sealed []byte
	// 加权随机 + 跳过冷却中的 Key；失败计数由调用方记录。
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, encrypted_key FROM channel_keys
		WHERE channel_id=$1 AND enabled=true AND (cooldown_until IS NULL OR cooldown_until < now())
		ORDER BY -ln(GREATEST(random(), 1e-9)) / GREATEST(weight, 1), last_used_at NULLS FIRST
		LIMIT 1`, channelID).Scan(&id, &sealed)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil
	}
	if err != nil {
		return "", "", err
	}
	_, _ = s.pool.Exec(ctx, `UPDATE channel_keys SET last_used_at=now() WHERE id=$1`, id)
	value, err := s.decrypt(sealed)
	return value, id, err
}

// ChannelKey 是后台展示用的 Key 视图，不包含明文。
type ChannelKey struct {
	ID         string     `json:"id"`
	Last4      string     `json:"last4"`
	Weight     int        `json:"weight"`
	Enabled    bool       `json:"enabled"`
	Failures   int        `json:"failures"`
	Cooldown   *time.Time `json:"cooldownUntil"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
	CreatedAt  time.Time  `json:"createdAt"`
	// Why the system switched the key off (e.g. AUTH_FAILED); empty when an operator did.
	DisabledReason string     `json:"disabledReason"`
	DisabledAt     *time.Time `json:"disabledAt"`
}

func (s *Service) ListChannelKeys(ctx context.Context, channelID string) ([]ChannelKey, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text, key_last4, weight, enabled, consecutive_failures, cooldown_until, last_used_at, created_at, disabled_reason, disabled_at FROM channel_keys WHERE channel_id=$1 ORDER BY created_at`, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ChannelKey, 0, 4)
	for rows.Next() {
		var item ChannelKey
		if err := rows.Scan(&item.ID, &item.Last4, &item.Weight, &item.Enabled, &item.Failures, &item.Cooldown, &item.LastUsedAt, &item.CreatedAt, &item.DisabledReason, &item.DisabledAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Service) UpdateChannelKey(ctx context.Context, keyID string, enabled *bool, weight *int) error {
	if weight != nil && (*weight < 0 || *weight > 100) {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "权重必须在 0 到 100 之间", Status: 400}
	}
	tag, err := s.pool.Exec(ctx, `UPDATE channel_keys SET enabled=COALESCE($2, enabled), weight=COALESCE($3, weight), disabled_reason=CASE WHEN $2 IS TRUE THEN '' ELSE disabled_reason END, disabled_at=CASE WHEN $2 IS TRUE THEN NULL ELSE disabled_at END WHERE id=$1`, keyID, enabled, weight)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return &generation.APIError{Code: "NOT_FOUND", Message: "Key 不存在", Status: 404}
	}
	return nil
}

func (s *Service) DeleteChannelKey(ctx context.Context, keyID string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM channel_keys WHERE id=$1`, keyID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return &generation.APIError{Code: "NOT_FOUND", Message: "Key 不存在", Status: 404}
	}
	return nil
}

func (s *Service) Statuses(ctx context.Context) (map[string]Status, error) {
	rows, err := s.pool.Query(ctx, `SELECT provider_code,key_last4,updated_at FROM provider_credentials`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]Status{}
	for rows.Next() {
		var code, last4 string
		var updated time.Time
		if err = rows.Scan(&code, &last4, &updated); err != nil {
			return nil, err
		}
		out[code] = Status{Configured: true, Last4: last4, UpdatedAt: &updated}
	}
	return out, rows.Err()
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

func (s *Service) decrypt(sealed []byte) (string, error) {
	block, err := aes.NewCipher(s.secret)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(sealed) < gcm.NonceSize() {
		return "", errors.New("invalid credential payload")
	}
	nonce, ciphertext := sealed[:gcm.NonceSize()], sealed[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func Mask(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 8 {
		return "••••"
	}
	return base64.RawURLEncoding.EncodeToString([]byte(key[:4]))[:4] + "••••" + key[len(key)-4:]
}

// DisableKey switches a key off with a machine-readable reason, so routing
// stops picking it and the admin console can say why.
func (s *Service) DisableKey(ctx context.Context, keyID, reason string) error {
	_, err := s.pool.Exec(ctx, `UPDATE channel_keys SET enabled=false, disabled_reason=$2, disabled_at=now() WHERE id=$1 AND enabled`, keyID, reason)
	return err
}

// KeyByID returns one key's plaintext and its channel, for connection tests.
func (s *Service) KeyByID(ctx context.Context, keyID string) (string, string, error) {
	var channelID string
	var sealed []byte
	if err := s.pool.QueryRow(ctx, `SELECT channel_id::text, encrypted_key FROM channel_keys WHERE id=$1`, keyID).Scan(&channelID, &sealed); err != nil {
		return "", "", &generation.APIError{Code: "NOT_FOUND", Message: "Key 不存在", Status: 404}
	}
	value, err := s.decrypt(sealed)
	return value, channelID, err
}
