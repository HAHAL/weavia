package assets

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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
		secret = "weavia-development-only"
	}
	return &Storage{root, []byte(secret)}
}
func (s *Storage) Token(objectKey string) string {
	encoded := base64.RawURLEncoding.EncodeToString([]byte(objectKey))
	mac := hmac.New(sha256.New, s.Secret)
	_, _ = mac.Write([]byte(encoded))
	return encoded + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func (s *Storage) ObjectKey(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid upload token")
	}
	mac := hmac.New(sha256.New, s.Secret)
	_, _ = mac.Write([]byte(parts[0]))
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
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
