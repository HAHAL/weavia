package recipes

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Skill struct {
	ID          string          `json:"id"`
	OwnerUserID string          `json:"ownerUserId,omitempty"`
	Name        string          `json:"name"`
	Slug        string          `json:"slug"`
	Category    string          `json:"category"`
	Description string          `json:"description"`
	Cover       string          `json:"cover"`
	Manifest    json.RawMessage `json:"manifest"`
	Version     int             `json:"version"`
	Visibility  string          `json:"visibility"`
	Status      string          `json:"status"`
	SourceURL   string          `json:"sourceUrl"`
	License     string          `json:"license"`
	Author      string          `json:"author"`
	Featured    bool            `json:"featured"`
}

type App struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Slug        string          `json:"slug"`
	Category    string          `json:"category"`
	Description string          `json:"description"`
	Cover       string          `json:"cover"`
	MediaType   string          `json:"mediaType"`
	Manifest    json.RawMessage `json:"manifest"`
	InputSchema json.RawMessage `json:"inputSchema"`
	Examples    json.RawMessage `json:"examples"`
	ModelHint   string          `json:"modelHint"`
	Credits     int64           `json:"credits"`
	Status      string          `json:"status"`
	Featured    bool            `json:"featured"`
	SortOrder   int             `json:"sortOrder"`
}

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

func (s *Service) ListSkills(ctx context.Context, userID string) ([]Skill, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,coalesce(owner_user_id::text,''),name,slug,category,description,coalesce(cover,''),manifest,version,visibility,status,source_url,license,author,featured
		FROM skills WHERE (visibility='public' AND status='published') OR ($1 <> '' AND owner_user_id=$1::uuid) ORDER BY featured DESC,created_at DESC LIMIT 200`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Skill{}
	for rows.Next() {
		var v Skill
		if err := rows.Scan(&v.ID, &v.OwnerUserID, &v.Name, &v.Slug, &v.Category, &v.Description, &v.Cover, &v.Manifest, &v.Version, &v.Visibility, &v.Status, &v.SourceURL, &v.License, &v.Author, &v.Featured); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Service) GetSkill(ctx context.Context, id, userID string) (Skill, error) {
	var v Skill
	err := s.pool.QueryRow(ctx, `SELECT id::text,coalesce(owner_user_id::text,''),name,slug,category,description,coalesce(cover,''),manifest,version,visibility,status,source_url,license,author,featured
		FROM skills WHERE id=$1 AND ((visibility='public' AND status='published') OR ($2 <> '' AND owner_user_id=$2::uuid))`, id, userID).Scan(&v.ID, &v.OwnerUserID, &v.Name, &v.Slug, &v.Category, &v.Description, &v.Cover, &v.Manifest, &v.Version, &v.Visibility, &v.Status, &v.SourceURL, &v.License, &v.Author, &v.Featured)
	return v, err
}

func (s *Service) CreateSkill(ctx context.Context, userID, name, category, description, sourceURL, license string, manifest json.RawMessage) (Skill, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(manifest) == 0 || len(manifest) > 256*1024 {
		return Skill{}, errors.New("Skill 名称或 manifest 无效")
	}
	slug := slugify(name) + "-" + shortID()
	var id string
	err := s.pool.QueryRow(ctx, `INSERT INTO skills(owner_user_id,name,slug,category,description,manifest,visibility,status,source_url,license,author)
		VALUES($1,$2,$3,$4,$5,$6,'private','pending',$7,$8,'customer') RETURNING id::text`, userID, name, slug, category, description, manifest, sourceURL, license).Scan(&id)
	if err != nil {
		return Skill{}, err
	}
	_, _ = s.pool.Exec(ctx, `INSERT INTO skill_versions(skill_id,version,manifest) VALUES($1,1,$2)`, id, manifest)
	return s.GetSkill(ctx, id, userID)
}

func (s *Service) AdminSkills(ctx context.Context) ([]Skill, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,coalesce(owner_user_id::text,''),name,slug,category,description,coalesce(cover,''),manifest,version,visibility,status,source_url,license,author,featured FROM skills ORDER BY created_at DESC LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Skill{}
	for rows.Next() {
		var v Skill
		if err := rows.Scan(&v.ID, &v.OwnerUserID, &v.Name, &v.Slug, &v.Category, &v.Description, &v.Cover, &v.Manifest, &v.Version, &v.Visibility, &v.Status, &v.SourceURL, &v.License, &v.Author, &v.Featured); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Service) ReviewSkill(ctx context.Context, id, status string, featured *bool) error {
	if status != "published" && status != "rejected" && status != "disabled" && status != "pending" && status != "draft" {
		return errors.New("invalid status")
	}
	_, err := s.pool.Exec(ctx, `UPDATE skills SET status=$2,visibility=CASE WHEN $2='published' THEN 'public' ELSE visibility END,featured=COALESCE($3,featured),updated_at=now() WHERE id=$1`, id, status, featured)
	return err
}

func (s *Service) ListApps(ctx context.Context) ([]App, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,name,slug,category,description,coalesce(cover,''),media_type,manifest,input_schema,examples,model_hint,credits,status,featured,sort_order FROM apps WHERE status='published' ORDER BY featured DESC,sort_order,name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []App{}
	for rows.Next() {
		var v App
		if err := rows.Scan(&v.ID, &v.Name, &v.Slug, &v.Category, &v.Description, &v.Cover, &v.MediaType, &v.Manifest, &v.InputSchema, &v.Examples, &v.ModelHint, &v.Credits, &v.Status, &v.Featured, &v.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Service) GetApp(ctx context.Context, id string) (App, error) {
	var v App
	err := s.pool.QueryRow(ctx, `SELECT id::text,name,slug,category,description,coalesce(cover,''),media_type,manifest,input_schema,examples,model_hint,credits,status,featured,sort_order FROM apps WHERE id=$1 AND status='published'`, id).Scan(&v.ID, &v.Name, &v.Slug, &v.Category, &v.Description, &v.Cover, &v.MediaType, &v.Manifest, &v.InputSchema, &v.Examples, &v.ModelHint, &v.Credits, &v.Status, &v.Featured, &v.SortOrder)
	return v, err
}

func (s *Service) AdminApps(ctx context.Context) ([]App, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,name,slug,category,description,coalesce(cover,''),media_type,manifest,input_schema,examples,model_hint,credits,status,featured,sort_order FROM apps ORDER BY sort_order,name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []App{}
	for rows.Next() {
		var v App
		if err := rows.Scan(&v.ID, &v.Name, &v.Slug, &v.Category, &v.Description, &v.Cover, &v.MediaType, &v.Manifest, &v.InputSchema, &v.Examples, &v.ModelHint, &v.Credits, &v.Status, &v.Featured, &v.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Service) SetAppStatus(ctx context.Context, id, status string) error {
	if status != "draft" && status != "published" && status != "disabled" {
		return errors.New("invalid status")
	}
	_, err := s.pool.Exec(ctx, `UPDATE apps SET status=$2,updated_at=now() WHERE id=$1`, id, status)
	return err
}

func Render(manifest json.RawMessage, inputs map[string]string) (string, error) {
	var m struct {
		PromptTemplate string `json:"promptTemplate"`
		Inputs         []struct {
			Key      string `json:"key"`
			Label    string `json:"label"`
			Required bool   `json:"required"`
		} `json:"inputs"`
	}
	if err := json.Unmarshal(manifest, &m); err != nil {
		return "", err
	}
	if strings.TrimSpace(m.PromptTemplate) == "" {
		return "", errors.New("manifest 缺少 promptTemplate")
	}
	for _, input := range m.Inputs {
		if input.Required && strings.TrimSpace(inputs[input.Key]) == "" {
			return "", fmt.Errorf("请填写%s", input.Label)
		}
	}
	prompt := m.PromptTemplate
	for key, value := range inputs {
		prompt = strings.ReplaceAll(prompt, "{{"+key+"}}", strings.TrimSpace(value))
	}
	if strings.Contains(prompt, "{{") {
		return "", errors.New("还有未填写的输入")
	}
	return prompt, nil
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var b strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else if r == ' ' || r == '-' || r == '_' {
			b.WriteRune('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		out = "skill"
	}
	return out
}
func shortID() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
