package conversation

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Attachment struct {
	ClientAssetID   string `json:"clientAssetId,omitempty"`
	UploadedAssetID string `json:"uploadedAssetId,omitempty"`
	Role            string `json:"role"`
	Mime            string `json:"mime"`
	Size            int64  `json:"size,omitempty"`
	SHA256          string `json:"sha256,omitempty"`
}

type Conversation struct {
	ID            string     `json:"id"`
	UserID        string     `json:"-"`
	WorkspaceID   string     `json:"workspaceId,omitempty"`
	ProjectID     string     `json:"projectId,omitempty"`
	Title         string     `json:"title"`
	Mode          string     `json:"mode"`
	Status        string     `json:"status"`
	LastMessageAt *time.Time `json:"lastMessageAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type Message struct {
	ID              string         `json:"id"`
	ConversationID  string         `json:"conversationId"`
	UserID          string         `json:"-"`
	Role            string         `json:"role"`
	Content         string         `json:"content"`
	Params          map[string]any `json:"params"`
	Attachments     []Attachment   `json:"attachments"`
	ClientMessageID string         `json:"clientMessageId,omitempty"`
	TaskID          string         `json:"taskId,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
}

type Store interface {
	Create(context.Context, Conversation) (Conversation, error)
	List(context.Context, string, int, string) ([]Conversation, error)
	Get(context.Context, string, string) (Conversation, []Message, error)
	Append(context.Context, Message) (Message, error)
}

type Service struct{ store Store }

func New(store Store) *Service                { return &Service{store: store} }
func NewPostgres(pool *pgxpool.Pool) *Service { return &Service{store: &postgresStore{pool: pool}} }

func (s *Service) Create(ctx context.Context, userID, title, mode, workspaceID, projectID string) (Conversation, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		title = "新会话"
	}
	if len([]rune(title)) > 120 {
		return Conversation{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "会话标题过长", Status: 400}
	}
	if mode == "" {
		mode = "image"
	}
	if mode != "image" && mode != "video" {
		return Conversation{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "会话类型无效", Status: 400}
	}
	return s.store.Create(ctx, Conversation{UserID: userID, Title: title, Mode: mode, WorkspaceID: workspaceID, ProjectID: projectID})
}

func (s *Service) List(ctx context.Context, userID string, limit int) ([]Conversation, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return s.store.List(ctx, userID, limit, "")
}

func (s *Service) Get(ctx context.Context, userID, id string) (Conversation, []Message, error) {
	c, messages, err := s.store.Get(ctx, userID, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Conversation{}, nil, &generation.APIError{Code: "NOT_FOUND", Message: "会话不存在", Status: 404}
	}
	return c, messages, err
}

func (s *Service) AppendUserMessage(ctx context.Context, userID, conversationID, content string, params map[string]any, attachments []Attachment, clientMessageID string) (Message, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return Message{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "消息不能为空", Status: 400}
	}
	if len([]rune(content)) > 8000 {
		return Message{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "消息过长", Status: 400}
	}
	if params == nil {
		params = map[string]any{}
	}
	if attachments == nil {
		attachments = []Attachment{}
	}
	msg, err := s.store.Append(ctx, Message{ConversationID: conversationID, UserID: userID, Role: "user", Content: content, Params: params, Attachments: attachments, ClientMessageID: clientMessageID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Message{}, &generation.APIError{Code: "NOT_FOUND", Message: "会话不存在", Status: 404}
	}
	return msg, err
}

type postgresStore struct{ pool *pgxpool.Pool }

const conversationCols = `id::text,user_id::text,coalesce(workspace_id::text,''),coalesce(project_id::text,''),title,mode,status,last_message_at,created_at,updated_at`

func scanConversation(row pgx.Row) (Conversation, error) {
	var c Conversation
	var last pgtype.Timestamptz
	err := row.Scan(&c.ID, &c.UserID, &c.WorkspaceID, &c.ProjectID, &c.Title, &c.Mode, &c.Status, &last, &c.CreatedAt, &c.UpdatedAt)
	if last.Valid {
		t := last.Time
		c.LastMessageAt = &t
	}
	return c, err
}

func (s *postgresStore) Create(ctx context.Context, c Conversation) (Conversation, error) {
	return scanConversation(s.pool.QueryRow(ctx, `INSERT INTO conversations(user_id,workspace_id,project_id,title,mode,status) VALUES($1,nullif($2,'')::uuid,nullif($3,'')::uuid,$4,$5,'active') RETURNING `+conversationCols, c.UserID, c.WorkspaceID, c.ProjectID, c.Title, c.Mode))
}

func (s *postgresStore) List(ctx context.Context, userID string, limit int, _ string) ([]Conversation, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+conversationCols+` FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Conversation{}
	for rows.Next() {
		c, err := scanConversation(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *postgresStore) Get(ctx context.Context, userID, id string) (Conversation, []Message, error) {
	c, err := scanConversation(s.pool.QueryRow(ctx, `SELECT `+conversationCols+` FROM conversations WHERE id=$1 AND user_id=$2`, id, userID))
	if err != nil {
		return Conversation{}, nil, err
	}
	rows, err := s.pool.Query(ctx, `SELECT id::text,conversation_id::text,role,content,params,attachments,coalesce(client_message_id,''),coalesce(task_id::text,''),created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at`, id)
	if err != nil {
		return Conversation{}, nil, err
	}
	defer rows.Close()
	messages := []Message{}
	for rows.Next() {
		var m Message
		var params, attachments []byte
		if err = rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &params, &attachments, &m.ClientMessageID, &m.TaskID, &m.CreatedAt); err != nil {
			return Conversation{}, nil, err
		}
		_ = json.Unmarshal(params, &m.Params)
		_ = json.Unmarshal(attachments, &m.Attachments)
		if m.Params == nil {
			m.Params = map[string]any{}
		}
		if m.Attachments == nil {
			m.Attachments = []Attachment{}
		}
		m.UserID = userID
		messages = append(messages, m)
	}
	return c, messages, rows.Err()
}

func (s *postgresStore) Append(ctx context.Context, m Message) (Message, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Message{}, err
	}
	defer tx.Rollback(ctx)
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2)`, m.ConversationID, m.UserID).Scan(&exists); err != nil {
		return Message{}, err
	}
	if !exists {
		return Message{}, pgx.ErrNoRows
	}
	params, _ := json.Marshal(m.Params)
	attachments, _ := json.Marshal(m.Attachments)
	var created time.Time
	var id string
	if err = tx.QueryRow(ctx, `INSERT INTO messages(conversation_id,user_id,role,content,params,attachments,client_message_id) VALUES($1,$2,'user',$3,$4,$5,nullif($6,'')) RETURNING id::text,created_at`, m.ConversationID, m.UserID, m.Content, params, attachments, m.ClientMessageID).Scan(&id, &created); err != nil {
		return Message{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE conversations SET last_message_at=now(),updated_at=now() WHERE id=$1`, m.ConversationID); err != nil {
		return Message{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Message{}, err
	}
	m.ID, m.CreatedAt = id, created
	return m, nil
}
