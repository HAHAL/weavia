package assets

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Storage struct {
	Root   string
	Secret []byte
}

func New(root, secret string) *Storage {
	if root == "" {
		root = "./var/assets"
	}
	if secret == "" {
		panic("STORAGE_SIGNING_KEY is required")
	}
	return &Storage{root, []byte(secret)}
}
func (s *Storage) Token(objectKey string) string {
	encoded := base64.RawURLEncoding.EncodeToString([]byte(objectKey))
	expires := strconv.FormatInt(time.Now().Add(10*time.Minute).Unix(), 10)
	payload := encoded + "." + expires
	mac := hmac.New(sha256.New, s.Secret)
	_, _ = mac.Write([]byte(payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func (s *Storage) ObjectKey(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid upload token")
	}
	expiry, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || time.Now().Unix() >= expiry {
		return "", fmt.Errorf("upload token expired")
	}
	payload := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, s.Secret)
	_, _ = mac.Write([]byte(payload))
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(signature, mac.Sum(nil)) {
		return "", fmt.Errorf("invalid upload token")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", err
	}
	key := string(raw)
	if !strings.HasPrefix(key, "references/") || strings.Contains(key, "..") {
		return "", fmt.Errorf("invalid object key")
	}
	return key, nil
}
func (s *Storage) Put(token string, body []byte) (string, error) {
	key, err := s.ObjectKey(token)
	if err != nil {
		return "", err
	}
	path := filepath.Join(s.Root, filepath.FromSlash(key))
	if err = os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return "", err
	}
	if err = os.WriteFile(path, body, 0o600); err != nil {
		return "", err
	}
	return key, nil
}
func (s *Storage) DataURL(objectKey, mime string) (string, bool) {
	if strings.Contains(objectKey, "..") {
		return "", false
	}
	body, err := os.ReadFile(filepath.Join(s.Root, filepath.FromSlash(objectKey)))
	if err != nil {
		return "", false
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(body), true
}
func (s *Storage) Read(objectKey string) ([]byte, bool) {
	if strings.Contains(objectKey, "..") {
		return nil, false
	}
	body, err := os.ReadFile(filepath.Join(s.Root, filepath.FromSlash(objectKey)))
	if err != nil {
		return nil, false
	}
	return body, true
}

func (s *Storage) Check(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := os.MkdirAll(s.Root, 0o750); err != nil {
		return err
	}
	f, err := os.CreateTemp(s.Root, ".readiness-*")
	if err != nil {
		return err
	}
	name := f.Name()
	if err = f.Close(); err != nil {
		_ = os.Remove(name)
		return err
	}
	return os.Remove(name)
}
