package showcase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Item struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	Title     string    `json:"title"`
	Tag       string    `json:"tag"`
	Prompt    string    `json:"prompt"`
	ImageKey  string    `json:"-"`
	ImageMime string    `json:"-"`
	Status    string    `json:"status"`
	SortOrder int       `json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
	// Reuse preset: what "一键同款" fills into the creation form.
	Media      string `json:"media"`
	Model      string `json:"model"`
	Ratio      string `json:"ratio"`
	Resolution string `json:"resolution"`
	Count      int    `json:"count"`
	UseCount   int    `json:"useCount"`
}

type CreateInput struct {
	Kind       string
	Title      string
	Tag        string
	Prompt     string
	Status     string
	SortOrder  int
	Media      string
	Model      string
	Ratio      string
	Resolution string
	Count      int
}

type Patch struct {
	Kind      *string
	Title     *string
	Tag       *string
	Prompt    *string
	Status     *string
	SortOrder  *int
	Media      *string
	Model      *string
	Ratio      *string
	Resolution *string
	Count      *int
}

type Service struct {
	pool *pgxpool.Pool
	root string
}

func New(pool *pgxpool.Pool, root string) *Service {
	return &Service{pool: pool, root: root}
}

const columns = `id::text,kind,title,tag,prompt,image_key,image_mime,status,sort_order,created_at,media,model,ratio,resolution,count,use_count`

func scan(row pgx.Row) (Item, error) {
	var item Item
	err := row.Scan(&item.ID, &item.Kind, &item.Title, &item.Tag, &item.Prompt, &item.ImageKey, &item.ImageMime, &item.Status, &item.SortOrder, &item.CreatedAt, &item.Media, &item.Model, &item.Ratio, &item.Resolution, &item.Count, &item.UseCount)
	return item, err
}

func (s *Service) List(ctx context.Context, publishedOnly bool) ([]Item, error) {
	query := `SELECT ` + columns + ` FROM showcase_items`
	if publishedOnly {
		query += ` WHERE status='published'`
	}
	query += ` ORDER BY kind, sort_order, created_at DESC`
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Item{}
	for rows.Next() {
		item, err := scan(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) Create(ctx context.Context, userID string, in CreateInput, body []byte) (Item, error) {
	in = withPresetDefaults(in)
	if err := validate(in); err != nil {
		return Item{}, err
	}
	if len(body) == 0 || len(body) > 10<<20 {
		return Item{}, &generation.APIError{Code: "INVALID_IMAGE", Message: "图片大小必须在 10MB 以内", Status: 400}
	}
	mime := detectMime(body)
	if mime == "" {
		return Item{}, &generation.APIError{Code: "INVALID_IMAGE", Message: "仅支持 JPEG / PNG / WebP 图片", Status: 400}
	}
	ext := map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[mime]
	key := "showcase/" + randomName() + "." + ext
	path := filepath.Join(s.root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return Item{}, err
	}
	if err := os.WriteFile(path, body, 0o640); err != nil {
		return Item{}, err
	}
	item, err := scan(s.pool.QueryRow(ctx, `INSERT INTO showcase_items(kind,title,tag,prompt,image_key,image_mime,status,sort_order,created_by,media,model,ratio,resolution,count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING `+columns, in.Kind, in.Title, in.Tag, in.Prompt, key, mime, in.Status, in.SortOrder, userID, in.Media, in.Model, in.Ratio, in.Resolution, in.Count))
	if err != nil {
		_ = os.Remove(path)
		return Item{}, err
	}
	return item, nil
}

func (s *Service) Update(ctx context.Context, id string, patch Patch) (Item, error) {
	current, err := s.get(ctx, id)
	if err != nil {
		return Item{}, err
	}
	if patch.Kind != nil {
		current.Kind = *patch.Kind
	}
	if patch.Title != nil {
		current.Title = *patch.Title
	}
	if patch.Tag != nil {
		current.Tag = *patch.Tag
	}
	if patch.Prompt != nil {
		current.Prompt = *patch.Prompt
	}
	if patch.Status != nil {
		current.Status = *patch.Status
	}
	if patch.SortOrder != nil {
		current.SortOrder = *patch.SortOrder
	}
	if patch.Media != nil {
		current.Media = *patch.Media
	}
	if patch.Model != nil {
		current.Model = strings.TrimSpace(*patch.Model)
	}
	if patch.Ratio != nil {
		current.Ratio = strings.TrimSpace(*patch.Ratio)
	}
	if patch.Resolution != nil {
		current.Resolution = strings.TrimSpace(*patch.Resolution)
	}
	if patch.Count != nil {
		current.Count = *patch.Count
	}
	in := withPresetDefaults(CreateInput{Kind: current.Kind, Title: current.Title, Tag: current.Tag, Prompt: current.Prompt, Status: current.Status, Media: current.Media, Model: current.Model, Ratio: current.Ratio, Resolution: current.Resolution, Count: current.Count})
	if err = validate(in); err != nil {
		return Item{}, err
	}
	return scan(s.pool.QueryRow(ctx, `UPDATE showcase_items SET kind=$2,title=$3,tag=$4,prompt=$5,status=$6,sort_order=$7,media=$8,model=$9,ratio=$10,resolution=$11,count=$12,updated_at=now() WHERE id=$1 RETURNING `+columns, id, in.Kind, in.Title, in.Tag, in.Prompt, in.Status, current.SortOrder, in.Media, in.Model, in.Ratio, in.Resolution, in.Count))
}

// RecordUse counts one "一键同款" so operators can rank presets by real use.
func (s *Service) RecordUse(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE showcase_items SET use_count=use_count+1 WHERE id=$1 AND status='published'`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return &generation.APIError{Code: "NOT_FOUND", Message: "示例不存在", Status: 404}
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	item, err := s.get(ctx, id)
	if err != nil {
		return err
	}
	if _, err = s.pool.Exec(ctx, `DELETE FROM showcase_items WHERE id=$1`, id); err != nil {
		return err
	}
	path := filepath.Join(s.root, filepath.FromSlash(item.ImageKey))
	if strings.HasPrefix(filepath.Clean(path), filepath.Clean(s.root)+string(os.PathSeparator)) {
		_ = os.Remove(path)
	}
	return nil
}

func (s *Service) Image(ctx context.Context, id string) (string, string, error) {
	item, err := s.get(ctx, id)
	if err != nil {
		return "", "", err
	}
	path := filepath.Join(s.root, filepath.FromSlash(item.ImageKey))
	if !strings.HasPrefix(filepath.Clean(path), filepath.Clean(s.root)+string(os.PathSeparator)) {
		return "", "", &generation.APIError{Code: "NOT_FOUND", Message: "示例图不存在", Status: 404}
	}
	if _, err = os.Stat(path); err != nil {
		return "", "", &generation.APIError{Code: "NOT_FOUND", Message: "示例图不存在", Status: 404}
	}
	return path, item.ImageMime, nil
}

func (s *Service) get(ctx context.Context, id string) (Item, error) {
	item, err := scan(s.pool.QueryRow(ctx, `SELECT `+columns+` FROM showcase_items WHERE id=$1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return Item{}, &generation.APIError{Code: "NOT_FOUND", Message: "示例图不存在", Status: 404}
	}
	return item, err
}

func withPresetDefaults(in CreateInput) CreateInput {
	if in.Media == "" {
		in.Media = "image"
	}
	if in.Count == 0 {
		in.Count = 1
	}
	return in
}

func validate(in CreateInput) error {
	in = withPresetDefaults(in)
	switch in.Media {
	case "image", "video":
	default:
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "媒体类型必须是 image 或 video", Status: 400}
	}
	if in.Count < 1 || in.Count > 4 {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "张数必须在 1-4 之间", Status: 400}
	}
	if len(in.Model) > 120 || len(in.Ratio) > 10 || len(in.Resolution) > 10 {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "模型或参数过长", Status: 400}
	}
	switch in.Kind {
	case "image", "work":
	default:
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "类型必须是 image 或 work", Status: 400}
	}
	if strings.TrimSpace(in.Title) == "" || len([]rune(in.Title)) > 120 {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "标题不能为空且不能超过 120 字", Status: 400}
	}
	if len([]rune(in.Tag)) > 40 || len([]rune(in.Prompt)) > 2000 {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "标签或提示词过长", Status: 400}
	}
	switch in.Status {
	case "draft", "published":
	default:
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "状态必须是 draft 或 published", Status: 400}
	}
	return nil
}

func detectMime(body []byte) string {
	if len(body) >= 3 && body[0] == 0xff && body[1] == 0xd8 && body[2] == 0xff {
		return "image/jpeg"
	}
	if len(body) >= 8 && string(body[:8]) == "\x89PNG\r\n\x1a\n" {
		return "image/png"
	}
	if len(body) >= 12 && string(body[:4]) == "RIFF" && string(body[8:12]) == "WEBP" {
		return "image/webp"
	}
	return ""
}

func randomName() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (i Item) String() string {
	return fmt.Sprintf("%s:%s", i.Kind, i.Title)
}
