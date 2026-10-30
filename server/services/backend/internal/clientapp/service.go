// Package clientapp holds what operators publish to desktop clients without a
// new build: the API address, the minimum allowed version and announcements.
package clientapp

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Config struct {
	APIBaseURL      string    `json:"apiBaseUrl"`
	MinVersion      string    `json:"minVersion"`
	LatestVersion   string    `json:"latestVersion"`
	DownloadMac     string    `json:"downloadMac"`
	DownloadWindows string    `json:"downloadWindows"`
	ReleaseNotes    string    `json:"releaseNotes"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type Announcement struct {
	ID        string     `json:"id"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	Level     string     `json:"level"`
	Pinned    bool       `json:"pinned"`
	Status    string     `json:"status"`
	StartsAt  *time.Time `json:"startsAt,omitempty"`
	EndsAt    *time.Time `json:"endsAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

type AnnouncementInput struct {
	Title    string     `json:"title"`
	Body     string     `json:"body"`
	Level    string     `json:"level"`
	Pinned   bool       `json:"pinned"`
	Status   string     `json:"status"`
	StartsAt *time.Time `json:"startsAt"`
	EndsAt   *time.Time `json:"endsAt"`
}

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

func invalid(message string) error {
	return &generation.APIError{Code: "INVALID_REQUEST", Message: message, Status: 400}
}

var versionPattern = regexp.MustCompile(`^\d+\.\d+\.\d+$`)

func (s *Service) Config(ctx context.Context) (Config, error) {
	var c Config
	err := s.pool.QueryRow(ctx, `SELECT api_base_url,min_version,latest_version,download_mac,download_windows,release_notes,updated_at FROM client_config WHERE id=true`).
		Scan(&c.APIBaseURL, &c.MinVersion, &c.LatestVersion, &c.DownloadMac, &c.DownloadWindows, &c.ReleaseNotes, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Config{}, nil
	}
	return c, err
}

func (s *Service) SaveConfig(ctx context.Context, c Config) (Config, error) {
	c.APIBaseURL = strings.TrimRight(strings.TrimSpace(c.APIBaseURL), "/")
	if c.APIBaseURL != "" {
		parsed, err := url.Parse(c.APIBaseURL)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || (parsed.Path != "" && parsed.Path != "/") {
			return Config{}, invalid("API 地址必须是 http(s)://域名或IP[:端口]，不带路径")
		}
	}
	for _, v := range []string{c.MinVersion, c.LatestVersion} {
		if v != "" && !versionPattern.MatchString(v) {
			return Config{}, invalid("版本号格式必须是 x.y.z")
		}
	}
	if c.MinVersion != "" && c.LatestVersion != "" && CompareVersions(c.MinVersion, c.LatestVersion) > 0 {
		return Config{}, invalid("最低版本不能高于最新版本")
	}
	for _, link := range []string{c.DownloadMac, c.DownloadWindows} {
		if link == "" {
			continue
		}
		if parsed, err := url.Parse(link); err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return Config{}, invalid("下载地址必须是 http(s) 链接")
		}
	}
	if len([]rune(c.ReleaseNotes)) > 4000 {
		return Config{}, invalid("更新说明不能超过 4000 字")
	}
	err := s.pool.QueryRow(ctx, `INSERT INTO client_config(id,api_base_url,min_version,latest_version,download_mac,download_windows,release_notes,updated_at)
		VALUES(true,$1,$2,$3,$4,$5,$6,now())
		ON CONFLICT (id) DO UPDATE SET api_base_url=EXCLUDED.api_base_url,min_version=EXCLUDED.min_version,latest_version=EXCLUDED.latest_version,
		  download_mac=EXCLUDED.download_mac,download_windows=EXCLUDED.download_windows,release_notes=EXCLUDED.release_notes,updated_at=now()
		RETURNING updated_at`, c.APIBaseURL, strings.TrimSpace(c.MinVersion), strings.TrimSpace(c.LatestVersion), strings.TrimSpace(c.DownloadMac), strings.TrimSpace(c.DownloadWindows), c.ReleaseNotes).Scan(&c.UpdatedAt)
	return c, err
}

// CompareVersions compares x.y.z strings numerically; malformed parts count as 0.
func CompareVersions(a, b string) int {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		var x, y int
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			if x < y {
				return -1
			}
			return 1
		}
	}
	return 0
}

const announcementColumns = `id::text,title,body,level,pinned,status,starts_at,ends_at,created_at,updated_at`

func scanAnnouncement(row pgx.Row) (Announcement, error) {
	var a Announcement
	err := row.Scan(&a.ID, &a.Title, &a.Body, &a.Level, &a.Pinned, &a.Status, &a.StartsAt, &a.EndsAt, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

func (s *Service) listAnnouncements(ctx context.Context, query string, args ...any) ([]Announcement, error) {
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Announcement{}
	for rows.Next() {
		a, err := scanAnnouncement(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ActiveAnnouncements is what clients see: published and inside its window.
func (s *Service) ActiveAnnouncements(ctx context.Context) ([]Announcement, error) {
	return s.listAnnouncements(ctx, `SELECT `+announcementColumns+` FROM announcements
		WHERE status='published' AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())
		ORDER BY pinned DESC, created_at DESC LIMIT 20`)
}

func (s *Service) AllAnnouncements(ctx context.Context) ([]Announcement, error) {
	return s.listAnnouncements(ctx, `SELECT `+announcementColumns+` FROM announcements ORDER BY created_at DESC LIMIT 200`)
}

func validateAnnouncement(in *AnnouncementInput) error {
	in.Title = strings.TrimSpace(in.Title)
	in.Body = strings.TrimSpace(in.Body)
	if in.Level == "" {
		in.Level = "info"
	}
	if in.Status == "" {
		in.Status = "draft"
	}
	if in.Title == "" || len([]rune(in.Title)) > 80 {
		return invalid("标题不能为空且不能超过 80 字")
	}
	if len([]rune(in.Body)) > 4000 {
		return invalid("正文不能超过 4000 字")
	}
	switch in.Level {
	case "info", "warning", "important":
	default:
		return invalid("级别必须是 info / warning / important")
	}
	switch in.Status {
	case "draft", "published":
	default:
		return invalid("状态必须是 draft 或 published")
	}
	if in.StartsAt != nil && in.EndsAt != nil && !in.EndsAt.After(*in.StartsAt) {
		return invalid("结束时间必须晚于开始时间")
	}
	return nil
}

func (s *Service) CreateAnnouncement(ctx context.Context, userID string, in AnnouncementInput) (Announcement, error) {
	if err := validateAnnouncement(&in); err != nil {
		return Announcement{}, err
	}
	return scanAnnouncement(s.pool.QueryRow(ctx, `INSERT INTO announcements(title,body,level,pinned,status,starts_at,ends_at,created_by)
		VALUES($1,$2,$3,$4,$5,$6,$7,NULLIF($8,'')::uuid) RETURNING `+announcementColumns, in.Title, in.Body, in.Level, in.Pinned, in.Status, in.StartsAt, in.EndsAt, userID))
}

func (s *Service) UpdateAnnouncement(ctx context.Context, id string, in AnnouncementInput) (Announcement, error) {
	if err := validateAnnouncement(&in); err != nil {
		return Announcement{}, err
	}
	a, err := scanAnnouncement(s.pool.QueryRow(ctx, `UPDATE announcements SET title=$2,body=$3,level=$4,pinned=$5,status=$6,starts_at=$7,ends_at=$8,updated_at=now()
		WHERE id=$1 RETURNING `+announcementColumns, id, in.Title, in.Body, in.Level, in.Pinned, in.Status, in.StartsAt, in.EndsAt))
	if errors.Is(err, pgx.ErrNoRows) {
		return Announcement{}, &generation.APIError{Code: "NOT_FOUND", Message: "公告不存在", Status: 404}
	}
	return a, err
}

func (s *Service) DeleteAnnouncement(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM announcements WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return &generation.APIError{Code: "NOT_FOUND", Message: "公告不存在", Status: 404}
	}
	return nil
}
