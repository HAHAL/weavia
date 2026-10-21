package assets

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxGeneratedBytes = 100 << 20

// SaveGenerated copies a provider result into WEAVIA storage and verifies the
// committed bytes before its key can be used for settlement.
func (s *Storage) SaveGenerated(ctx context.Context, taskID string, index int, source, mime string) (string, int64, error) {
	ext := map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm"}[mime]
	if ext == "" || !safeSegment(taskID) || index < 0 {
		return "", 0, fmt.Errorf("invalid generated asset metadata")
	}
	key := fmt.Sprintf("generated/%s/%d.%s", taskID, index, ext)
	body, err := fetchGenerated(ctx, source)
	if err != nil {
		return "", 0, err
	}
	if !validGenerated(body, mime) {
		return "", 0, fmt.Errorf("generated asset content does not match MIME type")
	}
	path := filepath.Join(s.Root, filepath.FromSlash(key))
	if err = os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return "", 0, err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".generated-*")
	if err != nil {
		return "", 0, err
	}
	defer os.Remove(tmp.Name())
	if err = tmp.Chmod(0o600); err == nil {
		_, err = tmp.Write(body)
	}
	if err == nil {
		err = tmp.Sync()
	}
	closeErr := tmp.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return "", 0, err
	}
	if err = os.Rename(tmp.Name(), path); err != nil {
		return "", 0, err
	}
	directory, err := os.Open(filepath.Dir(path))
	if err != nil {
		return "", 0, err
	}
	err = directory.Sync()
	closeErr = directory.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return "", 0, err
	}
	if err = s.VerifyGenerated(key, body); err != nil {
		return "", 0, err
	}
	return key, int64(len(body)), nil
}

func (s *Storage) VerifyGenerated(key string, expected []byte) error {
	if !validGeneratedKey(key) {
		return fmt.Errorf("invalid generated object key")
	}
	body, err := os.ReadFile(filepath.Join(s.Root, filepath.FromSlash(key)))
	if err != nil {
		return err
	}
	if len(body) == 0 || len(body) > maxGeneratedBytes {
		return fmt.Errorf("invalid generated asset size")
	}
	ext := strings.TrimPrefix(filepath.Ext(key), ".")
	mime := map[string]string{"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp", "mp4": "video/mp4", "webm": "video/webm"}[ext]
	if !validGenerated(body, mime) {
		return fmt.Errorf("generated asset content does not match MIME type")
	}
	if expected != nil && sha256.Sum256(body) != sha256.Sum256(expected) {
		return fmt.Errorf("generated asset readback mismatch")
	}
	return nil
}

func (s *Storage) GeneratedDataURL(key, mime string) (string, error) {
	if err := s.VerifyGenerated(key, nil); err != nil {
		return "", err
	}
	body, err := os.ReadFile(filepath.Join(s.Root, filepath.FromSlash(key)))
	if err != nil {
		return "", err
	}
	if !validGenerated(body, mime) {
		return "", fmt.Errorf("generated asset content does not match MIME type")
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(body), nil
}

func validGenerated(body []byte, mime string) bool {
	switch mime {
	case "video/mp4":
		return len(body) > 12 && (string(body[4:8]) == "ftyp" || (len(body) > 8 && string(body[:4]) == "\x1aE\xdf\xa3"))
	case "video/webm":
		return len(body) > 4 && body[0] == 0x1a && body[1] == 0x45 && body[2] == 0xdf && body[3] == 0xa3
	default:
		return validImage(body, mime)
	}
}

func safeSegment(value string) bool {
	if value == "" || len(value) > 128 {
		return false
	}
	for _, c := range value {
		if (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') && c != '-' && c != '_' {
			return false
		}
	}
	return true
}
func validGeneratedKey(key string) bool {
	parts := strings.Split(key, "/")
	if len(parts) != 3 || parts[0] != "generated" || !safeSegment(parts[1]) {
		return false
	}
	file := strings.Split(parts[2], ".")
	return len(file) == 2 && safeSegment(file[0]) && (file[1] == "png" || file[1] == "jpg" || file[1] == "webp")
}
func validImage(body []byte, mime string) bool {
	switch mime {
	case "image/png":
		return len(body) >= 8 && bytes.Equal(body[:8], []byte("\x89PNG\r\n\x1a\n"))
	case "image/jpeg":
		return len(body) >= 4 && body[0] == 0xff && body[1] == 0xd8 && body[len(body)-2] == 0xff && body[len(body)-1] == 0xd9
	case "image/webp":
		return len(body) >= 12 && string(body[:4]) == "RIFF" && string(body[8:12]) == "WEBP"
	}
	return false
}
func fetchGenerated(ctx context.Context, source string) ([]byte, error) {
	if strings.HasPrefix(source, "data:") {
		parts := strings.SplitN(source, ",", 2)
		if len(parts) != 2 || !strings.HasSuffix(parts[0], ";base64") || len(parts[1]) > base64.StdEncoding.EncodedLen(maxGeneratedBytes) {
			return nil, fmt.Errorf("invalid provider data URI")
		}
		body, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return nil, err
		}
		return body, nil
	}
	u, err := url.Parse(source)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || (u.Port() != "" && u.Port() != "443") {
		return nil, fmt.Errorf("invalid provider result URL")
	}
	// Resolve each connection ourselves; proxy and redirects cannot bypass the public-address check.
	transport := &http.Transport{Proxy: nil, DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		for _, candidate := range ips {
			if !publicResultIP(candidate.IP) {
				return nil, fmt.Errorf("provider result resolves to private address")
			}
		}
		if len(ips) == 0 {
			return nil, errors.New("provider result host has no addresses")
		}
		return (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
	}}
	defer transport.CloseIdleConnections()
	client := &http.Client{Timeout: 30 * time.Second, Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source, nil)
	if err != nil {
		return nil, err
	}
	response, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("provider result download returned %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxGeneratedBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) == 0 || len(body) > maxGeneratedBytes {
		return nil, fmt.Errorf("invalid provider result size")
	}
	return body, nil
}

func publicResultIP(ip net.IP) bool {
	if !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return false
	}
	for _, block := range []string{"100.64.0.0/10", "198.18.0.0/15"} {
		_, network, _ := net.ParseCIDR(block)
		if network.Contains(ip) {
			return false
		}
	}
	return true
}
