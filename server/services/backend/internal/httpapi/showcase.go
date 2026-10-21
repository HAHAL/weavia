package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/showcase"
)

type showcaseItem struct {
	showcase.Item
	ImageURL string `json:"imageUrl"`
}

func showcaseJSON(item showcase.Item) showcaseItem {
	return showcaseItem{Item: item, ImageURL: "/api/showcase/images/" + item.ID}
}

func (s *Server) listShowcase(w http.ResponseWriter, r *http.Request) {
	if s.Showcase == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "示例图库未初始化", Status: 503})
		return
	}
	items, err := s.Showcase.List(r.Context(), true)
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]showcaseItem, 0, len(items))
	for _, item := range items {
		out = append(out, showcaseJSON(item))
	}
	ok(w, map[string]any{"items": out})
}

func (s *Server) showcaseImage(w http.ResponseWriter, r *http.Request) {
	if s.Showcase == nil {
		http.NotFound(w, r)
		return
	}
	path, mime, err := s.Showcase.Image(r.Context(), chi.URLParam(r, "showcaseID"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "public, max-age=300")
	http.ServeFile(w, r, path)
}

func (s *Server) adminListShowcase(w http.ResponseWriter, r *http.Request) {
	if s.Showcase == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "示例图库未初始化", Status: 503})
		return
	}
	items, err := s.Showcase.List(r.Context(), false)
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]showcaseItem, 0, len(items))
	for _, item := range items {
		out = append(out, showcaseJSON(item))
	}
	ok(w, map[string]any{"items": out})
}

func (s *Server) adminUploadShowcase(w http.ResponseWriter, r *http.Request) {
	if s.Showcase == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "示例图库未初始化", Status: 503})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 12<<20)
	if err := r.ParseMultipartForm(12 << 20); err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_IMAGE", Message: "上传内容无效或超过 10MB", Status: 400})
		return
	}
	file, _, err := r.FormFile("image")
	if err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_IMAGE", Message: "请选择图片文件", Status: 400})
		return
	}
	defer file.Close()
	body, err := io.ReadAll(io.LimitReader(file, 10<<20+1))
	if err != nil || len(body) == 0 || len(body) > 10<<20 {
		writeError(w, &generation.APIError{Code: "INVALID_IMAGE", Message: "图片大小必须在 10MB 以内", Status: 400})
		return
	}
	sortOrder, _ := strconv.Atoi(strings.TrimSpace(r.FormValue("sortOrder")))
	input := showcase.CreateInput{
		Kind:      defaultString(r.FormValue("kind"), "image"),
		Title:     strings.TrimSpace(r.FormValue("title")),
		Tag:       strings.TrimSpace(r.FormValue("tag")),
		Prompt:    strings.TrimSpace(r.FormValue("prompt")),
		Status:    defaultString(r.FormValue("status"), "published"),
		SortOrder: sortOrder,
	}
	item, err := s.Showcase.Create(r.Context(), currentUser(r).ID, input, body)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, showcaseJSON(item))
}

func (s *Server) adminPatchShowcase(w http.ResponseWriter, r *http.Request) {
	if s.Showcase == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "示例图库未初始化", Status: 503})
		return
	}
	var body struct {
		Kind      *string `json:"kind"`
		Title     *string `json:"title"`
		Tag       *string `json:"tag"`
		Prompt    *string `json:"prompt"`
		Status    *string `json:"status"`
		SortOrder *int    `json:"sortOrder"`
	}
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := decoder.Decode(&body); err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "请求体无效", Status: 400})
		return
	}
	item, err := s.Showcase.Update(r.Context(), chi.URLParam(r, "showcaseID"), showcase.Patch{Kind: body.Kind, Title: body.Title, Tag: body.Tag, Prompt: body.Prompt, Status: body.Status, SortOrder: body.SortOrder})
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, showcaseJSON(item))
}

func (s *Server) adminDeleteShowcase(w http.ResponseWriter, r *http.Request) {
	if s.Showcase == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "示例图库未初始化", Status: 503})
		return
	}
	if err := s.Showcase.Delete(r.Context(), chi.URLParam(r, "showcaseID")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}
