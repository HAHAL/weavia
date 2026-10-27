package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

const DemoUserID = "00000000-0000-4000-8000-000000000001"

type User struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name,omitempty"`
	Status    string `json:"status"`
	AvatarURL string `json:"avatarUrl"`
}

var DemoUser = User{ID: DemoUserID, Email: "demo@weavia.local", Name: "WEAVIA Demo", Status: "active"}

type DeviceInfo struct {
	DeviceID   string `json:"deviceId"`
	DeviceName string `json:"deviceName"`
	Platform   string `json:"platform"`
	OSVersion  string `json:"osVersion"`
	AppVersion string `json:"appVersion"`
}
type Device struct {
	DeviceInfo
	UserID     string  `json:"userId"`
	CreatedAt  string  `json:"createdAt"`
	LastSeenAt string  `json:"lastSeenAt"`
	RevokedAt  *string `json:"revokedAt,omitempty"`
}
type SessionResult struct {
	SessionID    string `json:"sessionId"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    string `json:"expiresAt"`
	TokenType    string `json:"tokenType"`
	User         User   `json:"user"`
	Device       Device `json:"device"`
}
type Error struct {
	Code, Message string
	Status        int
	Cause         error
}

func (e *Error) Error() string { return e.Message }
func (e *Error) Unwrap() error { return e.Cause }

type Service struct {
	pool               *pgxpool.Pool
	webOrigin          string
	demoMode           bool
	mailer             Mailer
	verificationSecret string
	openRegistration   bool
}

func NewService(pool *pgxpool.Pool, webOrigin string, demoMode ...bool) *Service {
	enabled := len(demoMode) > 0 && demoMode[0]
	secret := os.Getenv("AUTH_VERIFICATION_SECRET")
	if secret == "" {
		secret = os.Getenv("STORAGE_SIGNING_KEY")
	}
	return &Service{pool: pool, webOrigin: webOrigin, demoMode: enabled, mailer: SMTPFromEnv(), verificationSecret: secret, openRegistration: os.Getenv("ALLOW_OPEN_REGISTRATION") == "true"}
}

func (s *Service) Register(ctx context.Context, email, password, name string, info DeviceInfo) (SessionResult, error) {
	if !s.openRegistration {
		return SessionResult{}, &Error{Code: "EMAIL_VERIFICATION_REQUIRED", Message: "请先完成邮箱验证", Status: 400}
	}
	email = normalizedEmail(email)
	name = strings.TrimSpace(name)
	if !validEmail(email) || len(password) < 8 || len(password) > 256 {
		return SessionResult{}, &Error{Code: "INVALID_REQUEST", Message: "邮箱或密码格式无效（密码至少 8 位）", Status: 400}
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE lower(btrim(email))=$1)`, email).Scan(&exists); err != nil {
		return SessionResult{}, err
	}
	if exists {
		return SessionResult{}, &Error{Code: "EMAIL_EXISTS", Message: "该邮箱已注册", Status: 409}
	}
	hash, err := hashPassword(password)
	if err != nil {
		return SessionResult{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionResult{}, err
	}
	defer tx.Rollback(ctx)
	var user User
	err = tx.QueryRow(ctx, `INSERT INTO users(email,name,status,email_verified_at,account_no) VALUES($1,$2,'active',now(),'WA'||lpad(nextval('user_account_no_seq')::text,6,'0')) RETURNING id::text,email,coalesce(name,''),status,coalesce(avatar_url,'')`, email, name).Scan(&user.ID, &user.Email, &user.Name, &user.Status, &user.AvatarURL)
	if err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO accounts(user_id,provider,provider_account_id,password_hash) VALUES($1,'password',$2,$3)`, user.ID, email, hash); err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO subscriptions(user_id,plan_id,status,current_period_start) SELECT $1,id,'active',now() FROM plans WHERE code='free'`, user.ID); err != nil {
		return SessionResult{}, err
	}
	var accountID string
	if err = tx.QueryRow(ctx, `INSERT INTO credit_accounts(user_id,available_balance) VALUES($1,50) RETURNING id::text`, user.ID).Scan(&accountID); err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO credit_transactions_v1(account_id,type,available_delta,reserved_delta,balance_after,reserved_after,reference_type,reference_id,idempotency_key,actor_user_id) VALUES($1,'topup',50,0,50,0,'registration',$2,$3,$4)`, accountID, user.ID, "registration:"+user.ID, user.ID); err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id) VALUES($1::uuid,'user.registered','user',$2)`, user.ID, user.ID); err != nil {
		return SessionResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return SessionResult{}, err
	}
	return s.issue(ctx, user, normalizeDevice(info, "web"))
}

func (s *Service) registerFailure(ctx context.Context, step string, err error) error {
	slog.Error("registration failed", "request_id", middleware.GetReqID(ctx), "register_step", step, "error_detail", err.Error())
	return fmt.Errorf("register step %s: %w", step, err)
}

func (s *Service) Login(ctx context.Context, email, password string, info DeviceInfo) (SessionResult, error) {
	info = normalizeDevice(info, "web")
	var user User
	var stored string
	err := s.pool.QueryRow(ctx, `SELECT u.id::text,u.email,coalesce(u.name,''),u.status,coalesce(u.avatar_url,''),a.password_hash FROM users u JOIN accounts a ON a.user_id=u.id AND a.provider='password' WHERE u.email=$1`, strings.ToLower(strings.TrimSpace(email))).Scan(&user.ID, &user.Email, &user.Name, &user.Status, &user.AvatarURL, &stored)
	if err != nil || !verifyPassword(stored, password) {
		s.recordLogin(ctx, user.ID, "", info.Platform, "invalid_credentials", false)
		return SessionResult{}, &Error{Code: "INVALID_CREDENTIALS", Message: "邮箱或密码错误", Status: 401}
	}
	if user.Status != "active" {
		s.recordLogin(ctx, user.ID, "", info.Platform, "user_disabled", false)
		return SessionResult{}, &Error{Code: "USER_DISABLED", Message: "账户已停用", Status: 403}
	}
	result, issueErr := s.issue(ctx, user, normalizeDevice(info, "web"))
	if issueErr != nil {
		s.recordLogin(ctx, user.ID, "", info.Platform, "session_error", false)
	} else {
		s.recordLogin(ctx, user.ID, result.SessionID, info.Platform, "", true)
	}
	return result, issueErr
}

func (s *Service) CreateDesktopSession(ctx context.Context, redirect string) (map[string]any, error) {
	if redirect == "" {
		redirect = "weavia://auth/callback"
	}
	parsed, err := url.Parse(redirect)
	if err != nil || parsed.Scheme != "weavia" || parsed.Host != "auth" || parsed.Path != "/callback" {
		return nil, &Error{Code: "INVALID_CALLBACK", Message: "回调地址无效", Status: 400}
	}
	id, state := uuid(), token()
	expires := time.Now().Add(5 * time.Minute)
	var initialUserID *string
	if s.demoMode {
		demoID := DemoUserID
		initialUserID = &demoID
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO auth_requests(id,user_id,state_hash,redirect_uri,expires_at) VALUES($1,$2,$3,$4,$5)`, id, initialUserID, state, redirect, expires)
	if err != nil {
		return nil, err
	}
	return map[string]any{"loginSessionId": id, "state": state, "loginUrl": s.webOrigin + "/login?session=" + url.QueryEscape(id), "expiresAt": expires.UTC().Format(time.RFC3339Nano)}, nil
}
func (s *Service) Authorize(ctx context.Context, loginID, userID string) (map[string]string, error) {
	if userID == "" {
		if !s.demoMode {
			return nil, &Error{Code: "INVALID_TOKEN", Message: "请先登录", Status: 401}
		}
		userID = DemoUserID
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var redirect, state string
	var expires time.Time
	var authorized *time.Time
	err = tx.QueryRow(ctx, `SELECT redirect_uri,state_hash,expires_at,authorized_at FROM auth_requests WHERE id=$1 FOR UPDATE`, loginID).Scan(&redirect, &state, &expires, &authorized)
	if err != nil || !time.Now().Before(expires) {
		return nil, &Error{Code: "SESSION_EXPIRED", Message: "登录请求已过期", Status: 400}
	}
	if authorized != nil {
		return nil, &Error{Code: "AUTH_CODE_USED", Message: "登录请求已完成", Status: 400}
	}
	code := token()
	_, err = tx.Exec(ctx, `UPDATE auth_requests SET user_id=$2,authorized_at=now() WHERE id=$1`, loginID, userID)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO auth_codes(id,auth_request_id,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')`, uuid(), loginID, digest(code))
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	callback, _ := url.Parse(redirect)
	q := callback.Query()
	q.Set("code", code)
	q.Set("state", state)
	callback.RawQuery = q.Encode()
	return map[string]string{"callbackUrl": callback.String()}, nil
}
func (s *Service) Exchange(ctx context.Context, code, state string, info DeviceInfo) (SessionResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionResult{}, err
	}
	defer tx.Rollback(ctx)
	var codeID string
	var expires time.Time
	var used *time.Time
	var stateHash string
	var user User
	err = tx.QueryRow(ctx, `SELECT c.id::text,c.expires_at,c.used_at,r.state_hash,u.id::text,u.email,coalesce(u.name,''),u.status,coalesce(u.avatar_url,'') FROM auth_codes c JOIN auth_requests r ON r.id=c.auth_request_id JOIN users u ON u.id=r.user_id WHERE c.code_hash=$1 FOR UPDATE`, digest(code)).Scan(&codeID, &expires, &used, &stateHash, &user.ID, &user.Email, &user.Name, &user.Status, &user.AvatarURL)
	if err != nil {
		s.recordLogin(ctx, "", "", "desktop", "oauth_failed", false)
		return SessionResult{}, &Error{Code: "INVALID_TOKEN", Message: "授权码无效", Status: 400}
	}
	if used != nil {
		s.recordLogin(ctx, "", "", "desktop", "oauth_failed", false)
		return SessionResult{}, &Error{Code: "AUTH_CODE_USED", Message: "授权码已使用", Status: 400}
	}
	if !time.Now().Before(expires) {
		s.recordLogin(ctx, "", "", "desktop", "oauth_failed", false)
		return SessionResult{}, &Error{Code: "AUTH_CODE_EXPIRED", Message: "授权码已过期", Status: 400}
	}
	if !hmac.Equal([]byte(stateHash), []byte(state)) {
		s.recordLogin(ctx, "", "", "desktop", "oauth_failed", false)
		return SessionResult{}, &Error{Code: "INVALID_STATE", Message: "登录状态校验失败", Status: 400}
	}
	if user.Status != "active" {
		s.recordLogin(ctx, "", "", "desktop", "oauth_failed", false)
		return SessionResult{}, &Error{Code: "USER_DISABLED", Message: "账户已停用", Status: 403}
	}
	_, err = tx.Exec(ctx, `UPDATE auth_codes SET used_at=now() WHERE id=$1`, codeID)
	if err != nil {
		return SessionResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return SessionResult{}, err
	}
	result, issueErr := s.issue(ctx, user, normalizeDevice(info, "desktop"))
	if issueErr != nil {
		s.recordLogin(ctx, user.ID, "", "desktop", "session_error", false)
	} else {
		s.recordLogin(ctx, user.ID, result.SessionID, "desktop", "", true)
	}
	return result, issueErr
}
func (s *Service) Refresh(ctx context.Context, value string) (SessionResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionResult{}, err
	}
	defer tx.Rollback(ctx)
	var sessionID string
	var family *string
	var reason *string
	var expires time.Time
	var revoked *time.Time
	var user User
	var info DeviceInfo
	err = tx.QueryRow(ctx, `SELECT s.id::text,s.refresh_expires_at,s.revoked_at,s.token_family_id::text,s.revoked_reason,u.id::text,u.email,coalesce(u.name,''),u.status,coalesce(u.avatar_url,''),d.device_fingerprint_hash,d.name,d.platform,coalesce(d.app_version,'') FROM sessions s JOIN users u ON u.id=s.user_id JOIN devices d ON d.id=s.device_id WHERE s.refresh_token_hash=$1 FOR UPDATE OF s`, digest(value)).Scan(&sessionID, &expires, &revoked, &family, &reason, &user.ID, &user.Email, &user.Name, &user.Status, &user.AvatarURL, &info.DeviceID, &info.DeviceName, &info.Platform, &info.AppVersion)
	if err == nil && revoked != nil && reason != nil && *reason == "rotated" && family != nil {
		_ = tx.Rollback(ctx)
		_, _ = s.pool.Exec(ctx, `UPDATE sessions SET revoked_at=coalesce(revoked_at,now()),revoked_reason='refresh_replay',updated_at=now() WHERE token_family_id=$1 AND revoked_at IS NULL`, *family)
		return SessionResult{}, &Error{Code: "REFRESH_REPLAY", Message: "登录已失效，请重新登录", Status: 401}
	}
	if err != nil || revoked != nil || !time.Now().Before(expires) {
		return SessionResult{}, &Error{Code: "REFRESH_FAILED", Message: "登录已失效，请重新登录", Status: 401}
	}
	if user.Status != "active" {
		return SessionResult{}, &Error{Code: "USER_DISABLED", Message: "账户已停用", Status: 403}
	}
	_, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at=now(),revoked_reason='rotated',updated_at=now() WHERE id=$1`, sessionID)
	if err != nil {
		return SessionResult{}, err
	}
	familyID := uuid()
	if family != nil {
		familyID = *family
	}
	result, issueErr := s.issueWithFamily(ctx, user, info, familyID)
	if issueErr != nil {
		return SessionResult{}, issueErr
	}
	if _, err = tx.Exec(ctx, `UPDATE sessions SET replaced_by_session_id=$2 WHERE id=$1`, sessionID, result.SessionID); err != nil {
		_, _ = s.pool.Exec(ctx, `UPDATE sessions SET revoked_at=now(),revoked_reason='refresh_rollback' WHERE id=$1`, result.SessionID)
		return SessionResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		_, _ = s.pool.Exec(ctx, `UPDATE sessions SET revoked_at=now(),revoked_reason='refresh_rollback' WHERE id=$1`, result.SessionID)
		return SessionResult{}, err
	}
	return result, nil
}
func (s *Service) Logout(ctx context.Context, value string) error {
	_, err := s.pool.Exec(ctx, `UPDATE sessions SET revoked_at=coalesce(revoked_at,now()),revoked_reason='logout',updated_at=now() WHERE refresh_token_hash=$1`, digest(value))
	return err
}
func (s *Service) Me(ctx context.Context, value string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx, `SELECT u.id::text,u.email,coalesce(u.name,''),u.status,coalesce(u.avatar_url,'') FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.access_token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active'`, digest(value)).Scan(&u.ID, &u.Email, &u.Name, &u.Status, &u.AvatarURL)
	if err != nil {
		return User{}, &Error{Code: "INVALID_TOKEN", Message: "访问令牌无效", Status: 401}
	}
	_, _ = s.pool.Exec(ctx, `UPDATE sessions SET last_active_at=now() WHERE access_token_hash=$1`, digest(value))
	if u.AvatarURL == "" {
		u.AvatarURL = DefaultAvatarID(u.ID)
	}
	return u, nil
}

var avatarIDs = []string{"mascot-fox", "mascot-bear", "mascot-rabbit", "mascot-cat", "mascot-owl", "mascot-bird"}

func DefaultAvatarID(userID string) string {
	return avatarIDs[0]
}

func (s *Service) SetAvatar(ctx context.Context, userID, avatarID string) (User, error) {
	valid := false
	for _, id := range avatarIDs {
		if id == avatarID {
			valid = true
			break
		}
	}
	if !valid {
		return User{}, &Error{Code: "INVALID_AVATAR", Message: "头像选项无效", Status: 400}
	}
	var user User
	err := s.pool.QueryRow(ctx, `UPDATE users SET avatar_url=$2,updated_at=now() WHERE id=$1 AND status='active' RETURNING id::text,email,coalesce(name,''),status,avatar_url`, userID, avatarID).Scan(&user.ID, &user.Email, &user.Name, &user.Status, &user.AvatarURL)
	if err != nil {
		return User{}, err
	}
	return user, nil
}
func (s *Service) ListDevices(ctx context.Context, userID string) ([]Device, error) {
	rows, err := s.pool.Query(ctx, `SELECT device_fingerprint_hash,name,platform,coalesce(app_version,''),created_at,last_active_at,revoked_at FROM devices WHERE user_id=$1 ORDER BY last_active_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Device{}
	for rows.Next() {
		var d Device
		var created, last time.Time
		var revoked *time.Time
		if err = rows.Scan(&d.DeviceID, &d.DeviceName, &d.Platform, &d.AppVersion, &created, &last, &revoked); err != nil {
			return nil, err
		}
		d.UserID = userID
		d.CreatedAt = created.UTC().Format(time.RFC3339Nano)
		d.LastSeenAt = last.UTC().Format(time.RFC3339Nano)
		if revoked != nil {
			v := revoked.UTC().Format(time.RFC3339Nano)
			d.RevokedAt = &v
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
func (s *Service) RevokeDevice(ctx context.Context, userID, fingerprint string) error {
	var count int
	err := s.pool.QueryRow(ctx, `WITH target AS (UPDATE devices SET revoked_at=now(),updated_at=now() WHERE user_id=$1 AND device_fingerprint_hash=$2 RETURNING id), revoked AS (UPDATE sessions SET revoked_at=coalesce(revoked_at,now()),revoked_reason='device_revoked',updated_at=now() WHERE device_id IN(SELECT id FROM target)) SELECT count(*) FROM target`, userID, fingerprint).Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		return &Error{Code: "DEVICE_NOT_FOUND", Message: "设备不存在", Status: 404}
	}
	return nil
}

func (s *Service) issue(ctx context.Context, user User, info DeviceInfo) (SessionResult, error) {
	return s.issueWithFamily(ctx, user, info, uuid())
}
func (s *Service) issueWithFamily(ctx context.Context, user User, info DeviceInfo, family string) (SessionResult, error) {
	access, refresh := token(), token()
	accessExpiry := time.Now().Add(15 * time.Minute)
	refreshExpiry := time.Now().Add(30 * 24 * time.Hour)
	fp := digest(info.DeviceID)
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionResult{}, err
	}
	defer tx.Rollback(ctx)
	var deviceID string
	var created, last time.Time
	err = tx.QueryRow(ctx, `INSERT INTO devices(user_id,device_fingerprint_hash,name,platform,app_version,last_active_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,now(),now(),now()) ON CONFLICT(user_id,device_fingerprint_hash) DO UPDATE SET name=excluded.name,platform=excluded.platform,app_version=excluded.app_version,last_active_at=now(),revoked_at=NULL,updated_at=now() RETURNING id::text,created_at,last_active_at`, user.ID, fp, info.DeviceName, info.Platform, info.AppVersion).Scan(&deviceID, &created, &last)
	if err != nil {
		return SessionResult{}, err
	}
	var sessionID string
	err = tx.QueryRow(ctx, `INSERT INTO sessions(user_id,access_token_hash,refresh_token_hash,device_id,expires_at,refresh_expires_at,token_family_id,last_active_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,now(),now(),now()) RETURNING id::text`, user.ID, digest(access), digest(refresh), deviceID, accessExpiry, refreshExpiry, family).Scan(&sessionID)
	if err != nil {
		return SessionResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return SessionResult{}, err
	}
	info.DeviceID = fp
	device := Device{DeviceInfo: info, UserID: user.ID, CreatedAt: created.UTC().Format(time.RFC3339Nano), LastSeenAt: last.UTC().Format(time.RFC3339Nano)}
	return SessionResult{sessionID, access, refresh, accessExpiry.UTC().Format(time.RFC3339Nano), "Bearer", user, device}, nil
}
func normalizeDevice(info DeviceInfo, fallback string) DeviceInfo {
	if info.DeviceID == "" {
		info.DeviceID = uuid()
	}
	if info.DeviceName == "" {
		info.DeviceName = "WEAVIA " + fallback
	}
	if info.Platform == "" {
		info.Platform = fallback
	}
	return info
}
func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func uuid() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
func digest(v string) string { sum := sha256.Sum256([]byte(v)); return hex.EncodeToString(sum[:]) }

// HashPassword exposes the same PBKDF2 format used by Login, for seed tools.
func HashPassword(password string) (string, error) { return hashPassword(password) }

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	derived := pbkdf2([]byte(password), salt, 210000, 32)
	return "pbkdf2-sha256$210000$" + base64.RawStdEncoding.EncodeToString(salt) + "$" + base64.RawStdEncoding.EncodeToString(derived), nil
}
func verifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2-sha256" || parts[1] != "210000" {
		return false
	}
	salt, e1 := base64.RawStdEncoding.DecodeString(parts[2])
	want, e2 := base64.RawStdEncoding.DecodeString(parts[3])
	if e1 != nil || e2 != nil {
		return false
	}
	got := pbkdf2([]byte(password), salt, 210000, len(want))
	return subtle.ConstantTimeCompare(got, want) == 1
}
func pbkdf2(password, salt []byte, iterations, keyLen int) []byte {
	out := make([]byte, 0, keyLen)
	for block := uint32(1); len(out) < keyLen; block++ {
		mac := hmac.New(sha256.New, password)
		mac.Write(salt)
		mac.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
		u := mac.Sum(nil)
		t := append([]byte(nil), u...)
		for i := 1; i < iterations; i++ {
			mac = hmac.New(sha256.New, password)
			mac.Write(u)
			u = mac.Sum(nil)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		out = append(out, t...)
	}
	return out[:keyLen]
}
