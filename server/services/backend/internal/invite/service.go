// Package invite 管理注册邀请码：校验、占用、释放与后台维护。
package invite

import (
	"context"
	"crypto/rand"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/auth"
)

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

type Code struct {
	ID         string     `json:"id"`
	Code       string     `json:"code"`
	Note       string     `json:"note"`
	MaxUses    int        `json:"maxUses"`
	UsedCount  int        `json:"usedCount"`
	Enabled    bool       `json:"enabled"`
	ExpiresAt  *time.Time `json:"expiresAt"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
}

type Service struct {
	pool     *pgxpool.Pool
	required bool
}

func New(pool *pgxpool.Pool, required bool) *Service {
	return &Service{pool: pool, required: required}
}

func (s *Service) Required() bool { return s.required }

func normalize(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// Claim 原子占用一次邀请码名额，失败返回 403，注册失败时用 Release 归还。
func (s *Service) Claim(ctx context.Context, code string) (string, error) {
	code = normalize(code)
	if code == "" {
		return "", &auth.Error{Code: "INVITE_REQUIRED", Message: "注册需要邀请码", Status: 403}
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		UPDATE invite_codes
		SET used_count = used_count + 1, last_used_at = now()
		WHERE upper(code) = $1 AND enabled = true
		  AND (expires_at IS NULL OR expires_at > now())
		  AND (max_uses = 0 OR used_count < max_uses)
		RETURNING id::text`, code).Scan(&id)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", &auth.Error{Code: "INVALID_INVITE", Message: "邀请码无效、已用完或已过期", Status: 403}
		}
		return "", err
	}
	return id, nil
}

// Bind 记录用户是通过哪个邀请码注册的。
func (s *Service) Bind(ctx context.Context, userID, codeID string) error {
	if userID == "" || codeID == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `UPDATE users SET invite_code_id=$2, updated_at=now() WHERE id=$1`, userID, codeID)
	return err
}

func (s *Service) Release(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `UPDATE invite_codes SET used_count = GREATEST(used_count - 1, 0) WHERE id=$1`, id)
	return err
}

func (s *Service) List(ctx context.Context) ([]Code, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text, code, note, max_uses, used_count, enabled, expires_at, created_at, last_used_at FROM invite_codes ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Code, 0, 16)
	for rows.Next() {
		var item Code
		if err := rows.Scan(&item.ID, &item.Code, &item.Note, &item.MaxUses, &item.UsedCount, &item.Enabled, &item.ExpiresAt, &item.CreatedAt, &item.LastUsedAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Service) Create(ctx context.Context, actorID, note string, maxUses, validDays int) (Code, error) {
	if maxUses < 0 {
		return Code{}, &auth.Error{Code: "INVALID_REQUEST", Message: "可用次数不能为负数", Status: 400}
	}
	if validDays < 0 || validDays > 3650 {
		return Code{}, &auth.Error{Code: "INVALID_REQUEST", Message: "有效期不合法", Status: 400}
	}
	code := randomCode(10)
	var expires *time.Time
	if validDays > 0 {
		value := time.Now().AddDate(0, 0, validDays)
		expires = &value
	}
	var item Code
	err := s.pool.QueryRow(ctx, `
		INSERT INTO invite_codes(code, note, max_uses, expires_at, created_by)
		VALUES($1,$2,$3,$4, nullif($5,'')::uuid)
		RETURNING id::text, code, note, max_uses, used_count, enabled, expires_at, created_at, last_used_at`,
		code, strings.TrimSpace(note), maxUses, expires, actorID).
		Scan(&item.ID, &item.Code, &item.Note, &item.MaxUses, &item.UsedCount, &item.Enabled, &item.ExpiresAt, &item.CreatedAt, &item.LastUsedAt)
	return item, err
}

func (s *Service) SetEnabled(ctx context.Context, id string, enabled bool) error {
	tag, err := s.pool.Exec(ctx, `UPDATE invite_codes SET enabled=$2 WHERE id=$1`, id, enabled)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return &auth.Error{Code: "NOT_FOUND", Message: "邀请码不存在", Status: 404}
	}
	return nil
}

func randomCode(length int) string {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "INVITE0000"
	}
	out := make([]byte, length)
	for i, b := range buf {
		out[i] = alphabet[int(b)%len(alphabet)]
	}
	return string(out)
}
