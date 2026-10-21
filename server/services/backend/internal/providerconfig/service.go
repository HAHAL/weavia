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
	var sealed []byte
	err := s.pool.QueryRow(ctx, `SELECT encrypted_key FROM channel_keys WHERE channel_id=$1 AND enabled=true ORDER BY last_used_at NULLS FIRST, created_at LIMIT 1`, channelID).Scan(&sealed)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return s.decrypt(sealed)
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
