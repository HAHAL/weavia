package auth

import (
	"bufio"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net"
	"net/textproto"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type Mailer interface {
	Send(context.Context, string, string, string) error
}
type SMTPMailer struct{ Host, Port, User, Password, From string }

func (m SMTPMailer) Send(ctx context.Context, to, subject, body string) error {
	if m.Host == "" || m.From == "" {
		return errors.New("SMTP is not configured")
	}
	port := m.Port
	if port == "" {
		port = "587"
	}
	dialer := net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(m.Host, port))
	if err != nil {
		return err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(30 * time.Second))
	tp := textproto.NewConn(conn)
	defer tp.Close()
	read := func(want int) error {
		code, _, e := tp.ReadResponse(want)
		if e != nil {
			return e
		}
		if code != want {
			return fmt.Errorf("SMTP response %d", code)
		}
		return nil
	}
	cmd := func(want int, format string, args ...any) error {
		if e := tp.PrintfLine(format, args...); e != nil {
			return e
		}
		return read(want)
	}
	if err = read(220); err != nil {
		return err
	}
	if err = cmd(250, "EHLO weavia.local"); err != nil {
		return err
	}
	if err = cmd(220, "STARTTLS"); err != nil {
		return err
	}
	tlsConn := tls.Client(conn, &tls.Config{ServerName: m.Host, MinVersion: tls.VersionTLS12})
	if err = tlsConn.HandshakeContext(ctx); err != nil {
		return err
	}
	tp = textproto.NewConn(tlsConn)
	if err = cmd(250, "EHLO weavia.local"); err != nil {
		return err
	}
	if m.User != "" {
		credential := base64.StdEncoding.EncodeToString([]byte("\x00" + m.User + "\x00" + m.Password))
		if err = cmd(235, "AUTH PLAIN %s", credential); err != nil {
			return err
		}
	}
	if err = cmd(250, "MAIL FROM:<%s>", m.From); err != nil {
		return err
	}
	if err = cmd(250, "RCPT TO:<%s>", to); err != nil {
		return err
	}
	if err = cmd(354, "DATA"); err != nil {
		return err
	}
	writer := bufio.NewWriter(tlsConn)
	message := "To: " + to + "\r\nSubject: =?UTF-8?B?" + base64.StdEncoding.EncodeToString([]byte(subject)) + "?=\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + body
	for _, line := range strings.Split(strings.ReplaceAll(message, "\r\n", "\n"), "\n") {
		if strings.HasPrefix(line, ".") {
			line = "." + line
		}
		if _, err = writer.WriteString(line + "\r\n"); err != nil {
			return err
		}
	}
	if _, err = writer.WriteString(".\r\n"); err != nil {
		return err
	}
	if err = writer.Flush(); err != nil {
		return err
	}
	return read(250)
}
func (s *Service) WithMailer(m Mailer) *Service { s.mailer = m; return s }
func (s *Service) verificationHash(v string) string {
	mac := hmac.New(sha256.New, []byte(s.verificationSecret))
	mac.Write([]byte(v))
	return hex.EncodeToString(mac.Sum(nil))
}
func verificationCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		panic(err)
	}
	return fmt.Sprintf("%06d", n.Int64())
}
func validEmail(email string) bool {
	return len(email) <= 320 && strings.Count(email, "@") == 1 && !strings.ContainsAny(email, " \t\r\n")
}
func normalizedEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }

var invalidCode = &Error{Code: "VERIFICATION_INVALID", Message: "验证码无效或已过期", Status: 400}

func (s *Service) RequestRegistration(ctx context.Context, email, password, name string) (map[string]any, error) {
	email = normalizedEmail(email)
	name = strings.TrimSpace(name)
	if s.verificationSecret == "" {
		return nil, errors.New("AUTH_VERIFICATION_SECRET or STORAGE_SIGNING_KEY is required")
	}
	if !validEmail(email) || len(password) < 8 || len(password) > 256 {
		return nil, &Error{Code: "INVALID_REQUEST", Message: "邮箱或密码格式无效", Status: 400}
	}
	var recent int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM email_verifications WHERE email=$1 AND purpose='registration' AND created_at>now()-interval '1 hour'`, email).Scan(&recent); err != nil {
		return nil, err
	}
	if recent >= 5 {
		return nil, &Error{Code: "RATE_LIMITED", Message: "请稍后再发送验证码", Status: 429}
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE lower(btrim(email))=$1)`, email).Scan(&exists); err != nil {
		return nil, err
	}
	if exists {
		return nil, &Error{Code: "EMAIL_EXISTS", Message: "该邮箱已注册", Status: 409}
	}
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}
	code, linkToken := verificationCode(), token()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO registration_requests(email,password_hash,name,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes') ON CONFLICT(email) WHERE completed_at IS NULL DO UPDATE SET password_hash=excluded.password_hash,name=excluded.name,expires_at=excluded.expires_at,updated_at=now() WHERE registration_requests.updated_at <= now()-interval '60 seconds' RETURNING id::text`, email, hash, name).Scan(&id)
	if err == pgx.ErrNoRows {
		return nil, &Error{Code: "RATE_LIMITED", Message: "请稍后再发送验证码", Status: 429}
	}
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `UPDATE email_verifications SET used_at=now() WHERE registration_request_id=$1 AND used_at IS NULL`, id)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO email_verifications(registration_request_id,email,purpose,code_hash,token_hash,expires_at,next_send_at) VALUES($1,$2,'registration',$3,$4,now()+interval '15 minutes',now()+interval '60 seconds')`, id, email, s.verificationHash(code), s.verificationHash(linkToken))
	if err != nil {
		return nil, err
	}
	if err = s.mailer.Send(ctx, email, "WEAVIA 邮箱验证码", "验证码："+code+"\n15 分钟内有效。请勿转发。\n验证链接："+s.webOrigin+"/signup?email="+url.QueryEscape(email)+"&token="+linkToken); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"requestId": id, "expiresInSeconds": 900}, nil
}
func (s *Service) VerifyRegistration(ctx context.Context, email, code, linkToken string, info DeviceInfo) (SessionResult, error) {
	email = normalizedEmail(email)
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionResult{}, err
	}
	defer tx.Rollback(ctx)
	var requestID, verificationID, passwordHash, name string
	var expires time.Time
	var used *time.Time
	var attempts int
	err = tx.QueryRow(ctx, `SELECT r.id::text,v.id::text,r.password_hash,r.name,v.expires_at,v.used_at,v.attempt_count FROM registration_requests r JOIN email_verifications v ON v.registration_request_id=r.id WHERE r.email=$1 AND r.completed_at IS NULL AND v.purpose='registration' ORDER BY v.created_at DESC LIMIT 1 FOR UPDATE OF r,v`, email).Scan(&requestID, &verificationID, &passwordHash, &name, &expires, &used, &attempts)
	if err != nil || used != nil || time.Now().After(expires) || attempts >= 5 {
		return SessionResult{}, invalidCode
	}
	supplied := code
	if linkToken != "" {
		supplied = linkToken
	}
	expected := s.verificationHash(supplied)
	column := "code_hash"
	if linkToken != "" {
		column = "token_hash"
	}
	var matches bool
	err = tx.QueryRow(ctx, `SELECT `+column+`=$2 FROM email_verifications WHERE id=$1`, verificationID, expected).Scan(&matches)
	if err != nil {
		return SessionResult{}, err
	}
	if !matches {
		_, _ = tx.Exec(ctx, `UPDATE email_verifications SET attempt_count=attempt_count+1 WHERE id=$1`, verificationID)
		_ = tx.Commit(ctx)
		return SessionResult{}, invalidCode
	}
	var user User
	err = tx.QueryRow(ctx, `INSERT INTO users(email,name,status,email_verified_at) VALUES($1,$2,'active',now()) RETURNING id::text,email,coalesce(name,''),status,coalesce(avatar_url,'')`, email, name).Scan(&user.ID, &user.Email, &user.Name, &user.Status, &user.AvatarURL)
	if err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO accounts(user_id,provider,provider_account_id,password_hash) VALUES($1,'password',$2,$3)`, user.ID, email, passwordHash); err != nil {
		return SessionResult{}, err
	}
	var subscriptionID string
	if err = tx.QueryRow(ctx, `INSERT INTO subscriptions(user_id,plan_id,status,current_period_start) SELECT $1,id,'active',now() FROM plans WHERE code='free' RETURNING id::text`, user.ID).Scan(&subscriptionID); err != nil {
		return SessionResult{}, err
	}
	var accountID string
	if err = tx.QueryRow(ctx, `INSERT INTO credit_accounts(user_id,available_balance) VALUES($1,50) RETURNING id::text`, user.ID).Scan(&accountID); err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO credit_transactions_v1(account_id,type,available_delta,reserved_delta,balance_after,reserved_after,reference_type,reference_id,idempotency_key,actor_user_id) VALUES($1,'topup',50,0,50,0,'registration',$2,$3,$4)`, accountID, user.ID, "registration:"+user.ID, user.ID); err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE email_verifications SET used_at=now(),user_id=$2 WHERE id=$1`, verificationID, user.ID); err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE registration_requests SET completed_at=now(),user_id=$2,password_hash='',updated_at=now() WHERE id=$1`, requestID, user.ID); err != nil {
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
func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	email = normalizedEmail(email)
	if s.verificationSecret == "" {
		return errors.New("verification secret is required")
	}
	if !validEmail(email) {
		return nil
	}
	var userID string
	if err := s.pool.QueryRow(ctx, `SELECT id::text FROM users WHERE lower(btrim(email))=$1 AND status='active'`, email).Scan(&userID); err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return err
	}
	var recent int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM email_verifications WHERE email=$1 AND purpose='password_reset' AND created_at>now()-interval '1 hour'`, email).Scan(&recent); err != nil {
		return err
	}
	if recent >= 5 {
		return nil
	}
	var next time.Time
	err := s.pool.QueryRow(ctx, `SELECT next_send_at FROM email_verifications WHERE email=$1 AND purpose='password_reset' ORDER BY created_at DESC LIMIT 1`, email).Scan(&next)
	if err == nil && time.Now().Before(next) {
		return nil
	}
	if err != nil && err != pgx.ErrNoRows {
		return err
	}
	code, linkToken := verificationCode(), token()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `UPDATE email_verifications SET used_at=now() WHERE user_id=$1 AND purpose='password_reset' AND used_at IS NULL`, userID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO email_verifications(user_id,email,purpose,code_hash,token_hash,expires_at,next_send_at) VALUES($1,$2,'password_reset',$3,$4,now()+interval '15 minutes',now()+interval '60 seconds')`, userID, email, s.verificationHash(code), s.verificationHash(linkToken))
	if err != nil {
		return err
	}
	if err = s.mailer.Send(ctx, email, "WEAVIA 密码重置验证码", "验证码："+code+"\n15 分钟内有效。请勿转发。\n重置链接："+s.webOrigin+"/password-reset?email="+url.QueryEscape(email)+"&token="+linkToken); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Service) ConfirmPasswordReset(ctx context.Context, email, code, linkToken, password string) error {
	email = normalizedEmail(email)
	if len(password) < 8 || len(password) > 256 {
		return &Error{Code: "INVALID_REQUEST", Message: "密码格式无效", Status: 400}
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var id, userID, storedCode, storedToken string
	var expires time.Time
	var used *time.Time
	var attempts int
	err = tx.QueryRow(ctx, `SELECT id::text,user_id::text,code_hash,token_hash,expires_at,used_at,attempt_count FROM email_verifications WHERE email=$1 AND purpose='password_reset' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, email).Scan(&id, &userID, &storedCode, &storedToken, &expires, &used, &attempts)
	if err != nil || used != nil || time.Now().After(expires) || attempts >= 5 {
		return invalidCode
	}
	got := s.verificationHash(code)
	want := storedCode
	if linkToken != "" {
		got = s.verificationHash(linkToken)
		want = storedToken
	}
	if !hmac.Equal([]byte(got), []byte(want)) {
		_, _ = tx.Exec(ctx, `UPDATE email_verifications SET attempt_count=attempt_count+1 WHERE id=$1`, id)
		_ = tx.Commit(ctx)
		return invalidCode
	}
	if _, err = tx.Exec(ctx, `UPDATE accounts SET password_hash=$2,updated_at=now() WHERE user_id=$1 AND provider='password'`, userID, hash); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE email_verifications SET used_at=now() WHERE id=$1`, id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at=coalesce(revoked_at,now()),revoked_reason='password_reset',updated_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id) VALUES($1,'user.password_reset','user',$1::text)`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func SMTPFromEnv() SMTPMailer {
	return SMTPMailer{Host: os.Getenv("SMTP_HOST"), Port: os.Getenv("SMTP_PORT"), User: os.Getenv("SMTP_USER"), Password: os.Getenv("SMTP_PASSWORD"), From: os.Getenv("SMTP_FROM")}
}
