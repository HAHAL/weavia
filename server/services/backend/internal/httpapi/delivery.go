package httpapi

import (
	_ "embed"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/delivery"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

//go:embed static/review.html
var reviewPage []byte

func (s *Server) deliveryReady(w http.ResponseWriter) bool {
	if s.Delivery == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "审阅服务未初始化", Status: 503})
		return false
	}
	return true
}

func requestOrigin(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

func (s *Server) createReviewLink(w http.ResponseWriter, r *http.Request) {
	if !s.deliveryReady(w) {
		return
	}
	var body struct {
		Title string          `json:"title"`
		Items []delivery.Item `json:"items"`
		Days  int             `json:"days"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	link, err := s.Delivery.Create(r.Context(), currentUser(r).ID, body.Title, body.Items, body.Days)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"link": link, "url": requestOrigin(r) + "/review/" + link.Token})
}

func (s *Server) listReviewLinks(w http.ResponseWriter, r *http.Request) {
	if !s.deliveryReady(w) {
		return
	}
	links, err := s.Delivery.List(r.Context(), currentUser(r).ID)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": links})
}

func (s *Server) revokeReviewLink(w http.ResponseWriter, r *http.Request) {
	if !s.deliveryReady(w) {
		return
	}
	if err := s.Delivery.Revoke(r.Context(), currentUser(r).ID, chi.URLParam(r, "linkID")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) reviewPageHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex")
	w.Header().Set("Referrer-Policy", "no-referrer")
	_, _ = w.Write(reviewPage)
}

func (s *Server) publicReview(w http.ResponseWriter, r *http.Request) {
	if !s.deliveryReady(w) {
		return
	}
	link, _, err := s.Delivery.Public(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	ok(w, map[string]any{"title": link.Title, "items": link.Items, "decisions": link.Decisions, "expiresAt": link.ExpiresAt})
}

func (s *Server) publicReviewFile(w http.ResponseWriter, r *http.Request) {
	if !s.deliveryReady(w) || s.Assets == nil {
		return
	}
	output, err := s.Delivery.Output(r.Context(), chi.URLParam(r, "token"), r.URL.Query().Get("key"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", output.MimeType)
	w.Header().Set("Cache-Control", "private, max-age=300")
	if err := s.Assets.ServeGenerated(w, r, output.ObjectKey, output.MimeType); err != nil {
		writeError(w, &generation.APIError{Code: "NOT_FOUND", Message: "结果文件不存在", Status: 404})
	}
}

func (s *Server) publicReviewDecision(w http.ResponseWriter, r *http.Request) {
	if !s.deliveryReady(w) {
		return
	}
	var body struct {
		ItemKey  string `json:"itemKey"`
		Decision string `json:"decision"`
		Note     string `json:"note"`
		Reviewer string `json:"reviewer"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	err := s.Delivery.Decide(r.Context(), chi.URLParam(r, "token"), body.ItemKey, body.Decision, body.Note, body.Reviewer)
	respond(w, map[string]bool{"saved": err == nil}, err)
}

func (s *Server) listMyProducts(w http.ResponseWriter, r *http.Request) {
	if s.Library == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "商品同步未初始化", Status: 503})
		return
	}
	items, err := s.Library.List(r.Context(), currentUser(r).ID)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) putMyProduct(w http.ResponseWriter, r *http.Request) {
	if s.Library == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "商品同步未初始化", Status: 503})
		return
	}
	var body struct {
		Data      json.RawMessage `json:"data"`
		Deleted   bool            `json:"deleted"`
		UpdatedAt time.Time       `json:"updatedAt"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	item, err := s.Library.Put(r.Context(), currentUser(r).ID, chi.URLParam(r, "localID"), body.Data, body.Deleted, body.UpdatedAt)
	respond(w, item, err)
}
