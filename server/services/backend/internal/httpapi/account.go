package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/auth"
)

type accountService interface {
	RequestRegistration(context.Context, string, string, string) (map[string]any, error)
	VerifyRegistration(context.Context, string, string, string, auth.DeviceInfo) (auth.SessionResult, error)
	RequestPasswordReset(context.Context, string) error
	ConfirmPasswordReset(context.Context, string, string, string, string) error
	ListSessions(context.Context, string, string) ([]auth.SessionView, error)
	RevokeSession(context.Context, string, string) error
	RevokeAllSessions(context.Context, string) error
	RequestDeletion(context.Context, string, string) (auth.DeletionRequest, error)
	CurrentDeletion(context.Context, string) (*auth.DeletionRequest, error)
	AdminDeletionRequests(context.Context) ([]map[string]any, error)
	ReviewDeletion(context.Context, string, string, string, string, string) error
}

func (s *Server) account() accountService { v, _ := s.Auth.(accountService); return v }
func (s *Server) registrationRequest(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.account().RequestRegistration(r.Context(), b.Email, b.Password, b.Name)
	respond(w, data, err)
}
func (s *Server) registrationResend(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.account().RequestRegistration(r.Context(), b.Email, b.Password, b.Name)
	respond(w, data, err)
}
func (s *Server) verifyRegistration(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Email      string          `json:"email"`
		Code       string          `json:"code"`
		Token      string          `json:"token"`
		DeviceInfo auth.DeviceInfo `json:"deviceInfo"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.account().VerifyRegistration(r.Context(), b.Email, b.Code, b.Token, b.DeviceInfo)
	respond(w, data, err)
}
func (s *Server) passwordResetRequest(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Email string `json:"email"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	if err := s.account().RequestPasswordReset(r.Context(), b.Email); err != nil {
		slog.Error("password reset request failed", "error", err)
	}
	ok(w, map[string]bool{"accepted": true})
}
func (s *Server) passwordResetConfirm(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Email       string `json:"email"`
		Code        string `json:"code"`
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	err := s.account().ConfirmPasswordReset(r.Context(), b.Email, b.Code, b.Token, b.NewPassword)
	respond(w, map[string]bool{"reset": err == nil}, err)
}
func (s *Server) listSessions(w http.ResponseWriter, r *http.Request) {
	access := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	data, err := s.account().ListSessions(r.Context(), currentUser(r).ID, access)
	respond(w, data, err)
}
func (s *Server) revokeSession(w http.ResponseWriter, r *http.Request) {
	err := s.account().RevokeSession(r.Context(), currentUser(r).ID, chi.URLParam(r, "sessionID"))
	respond(w, map[string]bool{"revoked": err == nil}, err)
}
func (s *Server) revokeAllSessions(w http.ResponseWriter, r *http.Request) {
	err := s.account().RevokeAllSessions(r.Context(), currentUser(r).ID)
	respond(w, map[string]bool{"revoked": err == nil}, err)
}
func (s *Server) requestDeletion(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Reason string `json:"reason"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.account().RequestDeletion(r.Context(), currentUser(r).ID, b.Reason)
	respond(w, data, err)
}
func (s *Server) currentDeletion(w http.ResponseWriter, r *http.Request) {
	data, err := s.account().CurrentDeletion(r.Context(), currentUser(r).ID)
	respond(w, data, err)
}
func (s *Server) adminDeletionRequests(w http.ResponseWriter, r *http.Request) {
	data, err := s.account().AdminDeletionRequests(r.Context())
	respond(w, data, err)
}
func (s *Server) approveDeletion(w http.ResponseWriter, r *http.Request) {
	s.reviewDeletion(w, r, "approve")
}
func (s *Server) rejectDeletion(w http.ResponseWriter, r *http.Request) {
	s.reviewDeletion(w, r, "reject")
}
func (s *Server) reviewDeletion(w http.ResponseWriter, r *http.Request, decision string) {
	var b struct {
		Reason string `json:"reason"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	err := s.account().ReviewDeletion(r.Context(), currentUser(r).ID, chi.URLParam(r, "requestID"), decision, b.Reason, clientIP(r))
	respond(w, map[string]bool{"reviewed": err == nil}, err)
}
