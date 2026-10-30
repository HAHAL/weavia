// Package delivery holds customer review links: a creator shares a set of
// finished task outputs with a brand, who approves or requests changes per item.
package delivery

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

// Item is one image or video in a review: a task output the creator owns.
type Item struct {
	Key         string `json:"key"`
	TaskID      string `json:"taskId"`
	OutputIndex int    `json:"outputIndex"`
	Title       string `json:"title"`
	MimeType    string `json:"mimeType,omitempty"`
}

type Decision struct {
	ItemKey   string    `json:"itemKey"`
	Decision  string    `json:"decision"`
	Note      string    `json:"note"`
	Reviewer  string    `json:"reviewer"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Link struct {
	ID        string     `json:"id"`
	Title     string     `json:"title"`
	Items     []Item     `json:"items"`
	Status    string     `json:"status"`
	ExpiresAt time.Time  `json:"expiresAt"`
	CreatedAt time.Time  `json:"createdAt"`
	Decisions []Decision `json:"decisions"`
	Token     string     `json:"token,omitempty"`
}

// TaskReader is the slice of the generation service review links need.
type TaskReader interface {
	Get(ctx context.Context, userID, taskID string) (generation.Task, bool, error)
}

type Service struct {
	pool  *pgxpool.Pool
	tasks TaskReader
}

func New(pool *pgxpool.Pool, tasks TaskReader) *Service { return &Service{pool: pool, tasks: tasks} }

func invalid(message string) error {
	return &generation.APIError{Code: "INVALID_REQUEST", Message: message, Status: 400}
}

var errNotFound = &generation.APIError{Code: "NOT_FOUND", Message: "审阅链接不存在或已失效", Status: 404}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Create checks every item is a successful output of the caller's own task.
func (s *Service) Create(ctx context.Context, userID, title string, items []Item, days int) (Link, error) {
	title = strings.TrimSpace(title)
	if title == "" || len([]rune(title)) > 80 {
		return Link{}, invalid("标题不能为空且不能超过 80 字")
	}
	if len(items) == 0 || len(items) > 60 {
		return Link{}, invalid("每个审阅链接包含 1-60 个结果")
	}
	if days < 1 || days > 30 {
		days = 7
	}
	seen := map[string]bool{}
	for i := range items {
		task, found, err := s.tasks.Get(ctx, userID, items[i].TaskID)
		if err != nil {
			return Link{}, err
		}
		if !found || task.Status != "success" || items[i].OutputIndex < 0 || items[i].OutputIndex >= len(task.Outputs) {
			return Link{}, invalid("只能分享自己已成功的云端结果")
		}
		items[i].MimeType = task.Outputs[items[i].OutputIndex].MimeType
		items[i].Key = items[i].TaskID + ":" + strconv.Itoa(items[i].OutputIndex)
		if seen[items[i].Key] {
			return Link{}, invalid("结果重复")
		}
		seen[items[i].Key] = true
		if strings.TrimSpace(items[i].Title) == "" {
			items[i].Title = "结果 " + strconv.Itoa(i+1)
		}
	}
	token := newToken()
	raw, _ := json.Marshal(items)
	var link Link
	err := s.pool.QueryRow(ctx, `INSERT INTO review_links(user_id,token_hash,title,items,expires_at) VALUES($1,$2,$3,$4,now()+make_interval(days=>$5))
		RETURNING id::text,title,status,expires_at,created_at`, userID, hashToken(token), title, raw, days).Scan(&link.ID, &link.Title, &link.Status, &link.ExpiresAt, &link.CreatedAt)
	if err != nil {
		return Link{}, err
	}
	link.Items, link.Token, link.Decisions = items, token, []Decision{}
	return link, nil
}

func (s *Service) decisions(ctx context.Context, linkID string) ([]Decision, error) {
	rows, err := s.pool.Query(ctx, `SELECT item_key,decision,note,reviewer,updated_at FROM review_decisions WHERE link_id=$1 ORDER BY updated_at`, linkID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Decision{}
	for rows.Next() {
		var d Decision
		if err := rows.Scan(&d.ItemKey, &d.Decision, &d.Note, &d.Reviewer, &d.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func scanLink(row pgx.Row, userID *string) (Link, error) {
	var link Link
	var raw []byte
	var owner string
	err := row.Scan(&link.ID, &owner, &link.Title, &raw, &link.Status, &link.ExpiresAt, &link.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Link{}, errNotFound
	}
	if err != nil {
		return Link{}, err
	}
	_ = json.Unmarshal(raw, &link.Items)
	if userID != nil {
		*userID = owner
	}
	return link, nil
}

const linkColumns = `id::text,user_id::text,title,items,status,expires_at,created_at`

// List returns the creator's links with the customer's decisions.
func (s *Service) List(ctx context.Context, userID string) ([]Link, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+linkColumns+` FROM review_links WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	links := []Link{}
	for rows.Next() {
		link, err := scanLink(rows, nil)
		if err != nil {
			rows.Close()
			return nil, err
		}
		links = append(links, link)
	}
	rows.Close()
	for i := range links {
		if links[i].Decisions, err = s.decisions(ctx, links[i].ID); err != nil {
			return nil, err
		}
	}
	return links, nil
}

func (s *Service) Revoke(ctx context.Context, userID, id string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE review_links SET status='revoked' WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

// Public resolves a token for the customer page; expired or revoked is 404.
func (s *Service) Public(ctx context.Context, token string) (Link, string, error) {
	var owner string
	link, err := scanLink(s.pool.QueryRow(ctx, `SELECT `+linkColumns+` FROM review_links WHERE token_hash=$1`, hashToken(token)), &owner)
	if err != nil {
		return Link{}, "", err
	}
	if link.Status != "active" || time.Now().After(link.ExpiresAt) {
		return Link{}, "", errNotFound
	}
	if link.Decisions, err = s.decisions(ctx, link.ID); err != nil {
		return Link{}, "", err
	}
	return link, owner, nil
}

func (s *Service) Decide(ctx context.Context, token, itemKey, decision, note, reviewer string) error {
	link, _, err := s.Public(ctx, token)
	if err != nil {
		return err
	}
	if decision != "approved" && decision != "changes" {
		return invalid("决定必须是通过或需修改")
	}
	found := false
	for _, item := range link.Items {
		if item.Key == itemKey {
			found = true
		}
	}
	if !found {
		return invalid("结果不在这个审阅链接里")
	}
	note, reviewer = strings.TrimSpace(note), strings.TrimSpace(reviewer)
	if len([]rune(note)) > 1000 || len([]rune(reviewer)) > 40 {
		return invalid("批注或称呼过长")
	}
	if decision == "changes" && note == "" {
		return invalid("需修改时请写明修改意见")
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO review_decisions(link_id,item_key,decision,note,reviewer) VALUES($1,$2,$3,$4,$5)
		ON CONFLICT (link_id,item_key) DO UPDATE SET decision=EXCLUDED.decision,note=EXCLUDED.note,reviewer=EXCLUDED.reviewer,updated_at=now()`, link.ID, itemKey, decision, note, reviewer)
	return err
}

// Output finds the task output behind an item so the public page can stream it.
func (s *Service) Output(ctx context.Context, token, itemKey string) (generation.Output, error) {
	link, owner, err := s.Public(ctx, token)
	if err != nil {
		return generation.Output{}, err
	}
	for _, item := range link.Items {
		if item.Key != itemKey {
			continue
		}
		task, found, err := s.tasks.Get(ctx, owner, item.TaskID)
		if err != nil {
			return generation.Output{}, err
		}
		if !found || item.OutputIndex >= len(task.Outputs) {
			return generation.Output{}, errNotFound
		}
		return task.Outputs[item.OutputIndex], nil
	}
	return generation.Output{}, errNotFound
}
