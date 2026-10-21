//go:build integration

package auth

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type captureMailer struct{ code string }

func (m *captureMailer) Send(_ context.Context, _ string, _ string, body string) error {
	m.code = regexp.MustCompile(`[0-9]{6}`).FindString(body)
	return nil
}
func TestAccountFoundationPostgres(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL is required")
	}
	if os.Getenv("WEAVIA_INTEGRATION_TEST_DB") != "1" {
		t.Fatal("isolated integration database required")
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(cfg.ConnConfig.Database, "_test") && !strings.HasSuffix(cfg.ConnConfig.Database, "_acceptance") {
		t.Fatal("database must end in _test or _acceptance")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	m := &captureMailer{}
	s := NewService(pool, "http://localhost:3000").WithMailer(m)
	s.verificationSecret = "integration-secret"
	email := fmt.Sprintf("account-%d@weavia.test", time.Now().UnixNano())
	password := "Strong-Pass-123!"
	if _, err = s.Register(ctx, email, password, "", DeviceInfo{}); err == nil {
		t.Fatal("legacy register bypassed verification")
	}
	if _, err = s.RequestRegistration(ctx, email, password, "Account Test"); err != nil {
		t.Fatal(err)
	}
	var users, credits int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE email=$1`, email).Scan(&users)
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM credit_accounts WHERE user_id IN(SELECT id FROM users WHERE email=$1)`, email).Scan(&credits)
	if users != 0 || credits != 0 {
		t.Fatalf("unverified user=%d credits=%d", users, credits)
	}
	registered, err := s.VerifyRegistration(ctx, email, m.code, "", DeviceInfo{DeviceID: "device-one", Platform: "web"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.VerifyRegistration(ctx, email, m.code, "", DeviceInfo{}); err == nil {
		t.Fatal("verification replay succeeded")
	}
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE email=$1`, email).Scan(&users)
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM credit_transactions_v1 WHERE actor_user_id=$1 AND reference_type='registration'`, registered.User.ID).Scan(&credits)
	if users != 1 || credits != 1 {
		t.Fatalf("verified user=%d grants=%d", users, credits)
	}
	_, _ = s.Login(ctx, email, "wrong", DeviceInfo{Platform: "web"})
	second, err := s.Login(ctx, email, password, DeviceInfo{DeviceID: "device-two", Platform: "web"})
	if err != nil {
		t.Fatal(err)
	}
	var success, failed int
	err = pool.QueryRow(ctx, `SELECT count(*) FILTER(WHERE success),count(*) FILTER(WHERE NOT success) FROM login_events WHERE user_id=$1`, registered.User.ID).Scan(&success, &failed)
	if err != nil || success < 1 || failed < 1 {
		t.Fatalf("login events success=%d failed=%d err=%v", success, failed, err)
	}
	rotated, err := s.Refresh(ctx, second.RefreshToken)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Refresh(ctx, second.RefreshToken); err == nil {
		t.Fatal("refresh replay succeeded")
	}
	if _, err = s.Me(ctx, rotated.AccessToken); err == nil {
		t.Fatal("refresh replay did not revoke token family")
	}
	second, err = s.Login(ctx, email, password, DeviceInfo{DeviceID: "device-two", Platform: "web"})
	if err != nil {
		t.Fatal(err)
	}
	sessions, err := s.ListSessions(ctx, registered.User.ID, second.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	current := 0
	for _, v := range sessions {
		if v.Current {
			current++
		}
	}
	if current != 1 {
		t.Fatalf("current sessions=%d", current)
	}
	if err = s.RevokeSession(ctx, registered.User.ID, second.SessionID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Me(ctx, second.AccessToken); err == nil {
		t.Fatal("single session remains active")
	}
	if _, err = s.Me(ctx, registered.AccessToken); err != nil {
		t.Fatal("other session revoked unexpectedly", err)
	}
	if err = s.RevokeAllSessions(ctx, registered.User.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Me(ctx, registered.AccessToken); err == nil {
		t.Fatal("revoke all failed")
	}
	reset, err := s.Login(ctx, email, password, DeviceInfo{DeviceID: "reset-device", Platform: "web"})
	if err != nil {
		t.Fatal(err)
	}
	if err = s.RequestPasswordReset(ctx, email); err != nil {
		t.Fatal(err)
	}
	if err = s.ConfirmPasswordReset(ctx, email, m.code, "", "New-Password-456!"); err != nil {
		t.Fatal(err)
	}
	if err = s.ConfirmPasswordReset(ctx, email, m.code, "", "Another-Password-789!"); err == nil {
		t.Fatal("password reset replay succeeded")
	}
	if _, err = s.Me(ctx, reset.AccessToken); err == nil {
		t.Fatal("password reset did not revoke sessions")
	}
	request, err := s.RequestDeletion(ctx, registered.User.ID, "test")
	if err != nil {
		t.Fatal(err)
	}
	var jobs int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM data_deletion_jobs WHERE request_id=$1`, request.ID).Scan(&jobs)
	if jobs != 0 {
		t.Fatal("job created without approval")
	}
	adminEmail := fmt.Sprintf("admin-%d@weavia.test", time.Now().UnixNano())
	if _, err = s.RequestRegistration(ctx, adminEmail, password, "Admin"); err != nil {
		t.Fatal(err)
	}
	admin, err := s.VerifyRegistration(ctx, adminEmail, m.code, "", DeviceInfo{})
	if err != nil {
		t.Fatal(err)
	}
	if err = s.ReviewDeletion(ctx, admin.User.ID, request.ID, "approve", "reviewed", ""); err != nil {
		t.Fatal(err)
	}
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM data_deletion_jobs WHERE request_id=$1 AND approved_by=$2`, request.ID, admin.User.ID).Scan(&jobs)
	if jobs != 1 {
		t.Fatal("approved request has no job")
	}
	var status string
	_ = pool.QueryRow(ctx, `SELECT status FROM users WHERE id=$1`, registered.User.ID).Scan(&status)
	if status != "frozen" {
		t.Fatalf("user status=%s", status)
	}
	if _, err = pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, registered.User.ID); err == nil {
		t.Fatal("physical user delete bypassed safeguard")
	}
}
