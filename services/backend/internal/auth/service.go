package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"sync"
	"time"
)

const demoUserID = "00000000-0000-4000-8000-000000000001"

type User struct {
	ID     string `json:"id"`
	Email  string `json:"email"`
	Name   string `json:"name,omitempty"`
	Status string `json:"status"`
}
type DeviceInfo struct {
	DeviceID   string `json:"deviceId"`
	DeviceName string `json:"deviceName"`
	Platform   string `json:"platform"`
	OSVersion  string `json:"osVersion"`
	AppVersion string `json:"appVersion"`
}
type Device struct {
	DeviceInfo
	UserID     string `json:"userId"`
	CreatedAt  string `json:"createdAt"`
	LastSeenAt string `json:"lastSeenAt"`
}
type SessionResult struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    string `json:"expiresAt"`
	TokenType    string `json:"tokenType"`
	User         User   `json:"user"`
	Device       Device `json:"device"`
}
type loginSession struct {
	State, RedirectURI string
	ExpiresAt          time.Time
	Authorized         bool
}
type authCode struct {
	State     string
	ExpiresAt time.Time
	Used      bool
}
type refreshSession struct {
	DeviceID  string
	ExpiresAt time.Time
	Revoked   bool
}
type accessSession struct{ ExpiresAt time.Time }

type Error struct {
	Code, Message string
	Status        int
}

func (e *Error) Error() string { return e.Message }

type Service struct {
	mu        sync.RWMutex
	webOrigin string
	logins    map[string]*loginSession
	codes     map[string]*authCode
	access    map[string]*accessSession
	refresh   map[string]*refreshSession
	devices   map[string]Device
}

var DemoUser = User{ID: demoUserID, Email: "demo@weavia.local", Name: "WEAVIA Demo", Status: "active"}

func NewService(webOrigin string) *Service {
	return &Service{webOrigin: webOrigin, logins: map[string]*loginSession{}, codes: map[string]*authCode{}, access: map[string]*accessSession{}, refresh: map[string]*refreshSession{}, devices: map[string]Device{}}
}

func (s *Service) CreateDesktopSession(redirect string) (map[string]any, error) {
	if redirect == "" {
		redirect = "weavia://auth/callback"
	}
	parsed, err := url.Parse(redirect)
	if err != nil || parsed.Scheme != "weavia" || parsed.Host != "auth" || parsed.Path != "/callback" {
		return nil, &Error{"INVALID_CALLBACK", "回调地址无效", 400}
	}
	id, state := token(), token()
	expires := time.Now().Add(5 * time.Minute)
	s.mu.Lock()
	s.logins[id] = &loginSession{State: state, RedirectURI: redirect, ExpiresAt: expires}
	s.mu.Unlock()
	return map[string]any{"loginSessionId": id, "state": state, "loginUrl": s.webOrigin + "/login?session=" + url.QueryEscape(id), "expiresAt": expires.UTC().Format(time.RFC3339Nano)}, nil
}

func (s *Service) Authorize(loginID string) (map[string]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session := s.logins[loginID]
	if session == nil || !time.Now().Before(session.ExpiresAt) {
		return nil, &Error{"SESSION_EXPIRED", "登录请求已过期", 400}
	}
	if session.Authorized {
		return nil, &Error{"AUTH_CODE_USED", "登录请求已完成", 400}
	}
	session.Authorized = true
	code := token()
	s.codes[code] = &authCode{State: session.State, ExpiresAt: time.Now().Add(5 * time.Minute)}
	callback, _ := url.Parse(session.RedirectURI)
	q := callback.Query()
	q.Set("code", code)
	q.Set("state", session.State)
	callback.RawQuery = q.Encode()
	return map[string]string{"callbackUrl": callback.String()}, nil
}

func (s *Service) Exchange(code, state string, info DeviceInfo) (SessionResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record := s.codes[code]
	if record == nil {
		return SessionResult{}, &Error{"INVALID_TOKEN", "授权码无效", 400}
	}
	if record.Used {
		return SessionResult{}, &Error{"AUTH_CODE_USED", "授权码已使用", 400}
	}
	if !time.Now().Before(record.ExpiresAt) {
		return SessionResult{}, &Error{"AUTH_CODE_EXPIRED", "授权码已过期", 400}
	}
	if record.State != state {
		return SessionResult{}, &Error{"INVALID_STATE", "登录状态校验失败", 400}
	}
	record.Used = true
	now := time.Now().UTC().Format(time.RFC3339Nano)
	device := Device{DeviceInfo: info, UserID: demoUserID, CreatedAt: now, LastSeenAt: now}
	s.devices[info.DeviceID] = device
	return s.issue(device), nil
}

func (s *Service) Refresh(value string) (SessionResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session := s.refresh[value]
	if session == nil || session.Revoked || !time.Now().Before(session.ExpiresAt) {
		return SessionResult{}, &Error{"REFRESH_FAILED", "登录已失效，请重新登录", 401}
	}
	session.Revoked = true
	device, ok := s.devices[session.DeviceID]
	if !ok {
		return SessionResult{}, &Error{"DEVICE_ERROR", "设备记录不存在", 400}
	}
	device.LastSeenAt = time.Now().UTC().Format(time.RFC3339Nano)
	s.devices[session.DeviceID] = device
	return s.issue(device), nil
}

func (s *Service) Logout(value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if session := s.refresh[value]; session != nil {
		session.Revoked = true
	}
}
func (s *Service) Me(value string) (User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	record := s.access[value]
	if record == nil || !time.Now().Before(record.ExpiresAt) {
		return User{}, &Error{"INVALID_TOKEN", "访问令牌无效", 401}
	}
	return DemoUser, nil
}
func (s *Service) issue(device Device) SessionResult {
	access, refresh := token(), token()
	expires := time.Now().Add(15 * time.Minute)
	s.access[access] = &accessSession{expires}
	s.refresh[refresh] = &refreshSession{DeviceID: device.DeviceID, ExpiresAt: time.Now().Add(30 * 24 * time.Hour)}
	return SessionResult{access, refresh, expires.UTC().Format(time.RFC3339Nano), "Bearer", DemoUser, device}
}
func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
