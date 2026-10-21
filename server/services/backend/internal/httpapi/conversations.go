package httpapi

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/conversation"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type conversationDetail struct {
	conversation.Conversation
	Messages []conversation.Message `json:"messages"`
}

func (s *Server) createConversation(w http.ResponseWriter, r *http.Request) {
	if s.Conversations == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "会话服务未初始化", Status: 503})
		return
	}
	var body struct {
		Title       string `json:"title"`
		Mode        string `json:"mode"`
		WorkspaceID string `json:"workspaceId"`
		ProjectID   string `json:"projectId"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	c, err := s.Conversations.Create(r.Context(), currentUser(r).ID, body.Title, body.Mode, body.WorkspaceID, body.ProjectID)
	respond(w, c, err)
}

func (s *Server) listConversations(w http.ResponseWriter, r *http.Request) {
	if s.Conversations == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "会话服务未初始化", Status: 503})
		return
	}
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if _, err := fmt.Sscanf(raw, "%d", &limit); err != nil {
			limit = 20
		}
	}
	items, err := s.Conversations.List(r.Context(), currentUser(r).ID, limit)
	respond(w, map[string]any{"items": items}, err)
}

func (s *Server) getConversation(w http.ResponseWriter, r *http.Request) {
	if s.Conversations == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "会话服务未初始化", Status: 503})
		return
	}
	c, messages, err := s.Conversations.Get(r.Context(), currentUser(r).ID, chi.URLParam(r, "conversationID"))
	if err != nil {
		writeError(w, err)
		return
	}
	respond(w, conversationDetail{Conversation: c, Messages: messages}, nil)
}

func (s *Server) appendConversationMessage(w http.ResponseWriter, r *http.Request) {
	if s.Conversations == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "会话服务未初始化", Status: 503})
		return
	}
	var body struct {
		Content         string                    `json:"content"`
		Params          map[string]any            `json:"params"`
		Attachments     []conversation.Attachment `json:"attachments"`
		ClientMessageID string                    `json:"clientMessageId"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	msg, err := s.Conversations.AppendUserMessage(r.Context(), currentUser(r).ID, chi.URLParam(r, "conversationID"), body.Content, body.Params, body.Attachments, body.ClientMessageID)
	respond(w, msg, err)
}
