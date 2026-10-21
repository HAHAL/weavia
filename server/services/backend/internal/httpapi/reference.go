package httpapi

import (
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

func (s *Server) referenceImage(w http.ResponseWriter, r *http.Request) {
	if s.Assets == nil {
		http.NotFound(w, r)
		return
	}
	key, err := s.Assets.ObjectKey(chi.URLParam(r, "token"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	body, ok := s.Assets.Read(key)
	if !ok {
		http.NotFound(w, r)
		return
	}
	contentType := "image/png"
	switch strings.ToLower(filepath.Ext(key)) {
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".webp":
		contentType = "image/webp"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.Header().Set("Cache-Control", "private, max-age=600")
	_, _ = w.Write(body)
}
