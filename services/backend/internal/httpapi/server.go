package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Server struct {
	Auth                 *auth.Service
	Generation           *generation.Service
	Assets               *assets.Storage
	AntDigitalConfigured bool
	DashScopeConfigured  bool
	RealAIEnabled        bool
	AntDigitalBaseURL    string
	DashScopeBaseURL     string
	mu                   sync.RWMutex
	providerEnabled      bool
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(cors, middleware.RequestID, middleware.RealIP, middleware.Recoverer, middleware.Timeout(3*time.Minute))
	r.Get("/api/health", s.health)
	r.Post("/api/auth/desktop/session", s.desktopSession)
	r.Post("/api/auth/desktop/authorize", s.authorize)
	r.Post("/api/auth/desktop/exchange", s.exchange)
	r.Post("/api/auth/refresh", s.refresh)
	r.Post("/api/auth/logout", s.logout)
	r.Get("/api/auth/me", s.me)
	r.Route("/api", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(s.requireUser)
			r.Get("/ai/catalog", s.catalog)
			r.Post("/ai/estimate", s.estimate)
			r.Get("/ai/templates", s.templates)
			r.Post("/ai/tasks", s.createTask)
			r.Get("/ai/tasks", s.listTasks)
			r.Get("/ai/tasks/{taskID}", s.getTask)
			r.Post("/assets/presign", s.presign)
		})
	})
	r.Put("/api/assets/upload/{token}", s.upload)
	r.Get("/api/admin/ai/catalog", s.adminCatalog)
	r.Get("/api/admin/ai/providers", s.adminProviders)
	r.Get("/api/admin/ai/models", s.adminModels)
	r.Get("/api/admin/ai/routing", s.adminRouting)
	r.Get("/api/admin/ai/usage", s.adminUsage)
	r.Patch("/api/admin/ai/providers/{providerID}", s.patchProvider)
	return r
}

func cors(next http.Handler) http.Handler {
	allowed := map[string]bool{"tauri://localhost": true, "http://localhost:1420": true, "http://127.0.0.1:1420": true, "http://localhost:3001": true}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type userKey struct{}

func (s *Server) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, &auth.Error{Code: "INVALID_TOKEN", Message: "WEAVIA Access Token 缺失", Status: 401})
			return
		}
		user, err := s.Auth.Me(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			writeError(w, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey{}, user)))
	})
}
func currentUser(r *http.Request) auth.User { return r.Context().Value(userKey{}).(auth.User) }

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"service": "weavia-cloud-api", "status": "ok", "version": "0.1.0", "providers": map[string]any{"antdigital": map[string]bool{"configured": s.AntDigitalConfigured}, "dashscope": map[string]bool{"configured": s.DashScopeConfigured}}})
}
func (s *Server) desktopSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RedirectURI string `json:"redirectUri"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Auth.CreateDesktopSession(body.RedirectURI)
	respond(w, data, err)
}
func (s *Server) authorize(w http.ResponseWriter, r *http.Request) {
	var body struct {
		LoginSessionID string `json:"loginSessionId"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Auth.Authorize(body.LoginSessionID)
	respond(w, data, err)
}
func (s *Server) exchange(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code       string          `json:"code"`
		State      string          `json:"state"`
		DeviceInfo auth.DeviceInfo `json:"deviceInfo"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Auth.Exchange(body.Code, body.State, body.DeviceInfo)
	respond(w, data, err)
}
func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Auth.Refresh(body.RefreshToken)
	respond(w, data, err)
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	_ = decode(r, &body)
	s.Auth.Logout(body.RefreshToken)
	ok(w, map[string]bool{"loggedOut": true})
}
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		writeError(w, &auth.Error{Code: "INVALID_TOKEN", Message: "访问令牌缺失", Status: 401})
		return
	}
	user, err := s.Auth.Me(strings.TrimPrefix(header, "Bearer "))
	respond(w, user, err)
}
func (s *Server) catalog(w http.ResponseWriter, r *http.Request) {
	ok(w, generation.PublicCatalog(currentUser(r)))
}
func (s *Server) estimate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Workflow   string `json:"workflow"`
		Model      string `json:"model"`
		ImageCount int    `json:"imageCount"`
		Advanced   bool   `json:"advancedSelection"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	data, err := generation.Estimate(currentUser(r), body.Model, body.ImageCount, body.Advanced)
	respond(w, data, err)
}
func (s *Server) templates(w http.ResponseWriter, _ *http.Request) { ok(w, generation.Templates) }
func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	var input generation.Request
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	task, err := s.Generation.Create(r.Context(), currentUser(r), input)
	respond(w, task, err)
}
func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) {
	tasks, err := s.Generation.List(r.Context(), currentUser(r).ID)
	respond(w, tasks, err)
}
func (s *Server) getTask(w http.ResponseWriter, r *http.Request) {
	task, found, err := s.Generation.Get(r.Context(), currentUser(r).ID, chi.URLParam(r, "taskID"))
	if err != nil {
		writeError(w, err)
		return
	}
	if !found {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "任务不存在", Status: 404})
		return
	}
	ok(w, task)
}
func (s *Server) presign(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AssetID     string `json:"assetId"`
		ContentType string `json:"contentType"`
		Size        int64  `json:"size"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.AssetID == "" || body.Size <= 0 || body.Size > 5*1024*1024 {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "参考图必须小于或等于 5 MB", Status: 413})
		return
	}
	extensions := map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
	ext, allowed := extensions[body.ContentType]
	if !allowed {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "仅支持 PNG、JPG 和 WEBP 参考图", Status: 415})
		return
	}
	objectKey := fmt.Sprintf("references/%s/%s.%s", currentUser(r).ID, body.AssetID, ext)
	token := s.Assets.Token(objectKey)
	scheme := "http"
	if forwarded := r.Header.Get("X-Forwarded-Proto"); forwarded != "" {
		scheme = forwarded
	}
	host := r.Host
	if forwarded := r.Header.Get("X-Forwarded-Host"); forwarded != "" {
		host = forwarded
	}
	requestID := middleware.GetReqID(r.Context())
	ok(w, map[string]any{"uploadUrl": scheme + "://" + host + "/api/assets/upload/" + token, "objectKey": objectKey, "expiresAt": time.Now().Add(10 * time.Minute).UTC().Format(time.RFC3339Nano), "requestId": requestID})
}
func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 5*1024*1024+1))
	if err != nil || len(body) > 5*1024*1024 {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "上传内容无效", Status: 413})
		return
	}
	if _, err = s.Assets.Put(chi.URLParam(r, "token"), body); err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "上传令牌无效", Status: 400})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) providers() []generation.Provider {
	s.mu.RLock()
	defer s.mu.RUnlock()
	timestamp := time.Unix(0, 0).UTC().Format(time.RFC3339)
	return []generation.Provider{
		{ID: "00000000-0000-4000-8000-000000000101", Code: "antdigital", Name: "Ant Digital MaaS", Type: "openai-compatible", BaseURL: s.AntDigitalBaseURL, Enabled: s.providerEnabled && s.RealAIEnabled, Configured: s.AntDigitalConfigured, CreatedAt: timestamp, UpdatedAt: timestamp, ModelCount: 2},
		{ID: "00000000-0000-4000-8000-000000000105", Code: "dashscope", Name: "Alibaba Cloud Model Studio", Type: "dashscope-multimodal", BaseURL: s.DashScopeBaseURL, Enabled: s.providerEnabled && s.RealAIEnabled, Configured: s.DashScopeConfigured, CreatedAt: timestamp, UpdatedAt: timestamp, ModelCount: 1},
	}
}
func (s *Server) snapshot() map[string]any {
	return map[string]any{"providers": s.providers(), "models": generation.Models, "logicalModels": generation.LogicalModels, "bindings": generation.Bindings, "usage": []any{}, "estimatedCost": 0}
}
func (s *Server) adminCatalog(w http.ResponseWriter, _ *http.Request) { ok(w, s.snapshot()) }
func (s *Server) adminProviders(w http.ResponseWriter, _ *http.Request) {
	ok(w, s.providers())
}
func (s *Server) adminModels(w http.ResponseWriter, _ *http.Request) {
	ok(w, map[string]any{"providerModels": generation.Models, "logicalModels": generation.LogicalModels})
}
func (s *Server) adminRouting(w http.ResponseWriter, _ *http.Request) {
	ok(w, map[string]any{"logicalModels": generation.LogicalModels, "bindings": generation.Bindings})
}
func (s *Server) adminUsage(w http.ResponseWriter, _ *http.Request) {
	ok(w, map[string]any{"usage": []any{}, "estimatedCost": 0})
}
func (s *Server) patchProvider(w http.ResponseWriter, r *http.Request) {
	providerID := chi.URLParam(r, "providerID")
	if providerID != "00000000-0000-4000-8000-000000000101" && providerID != "00000000-0000-4000-8000-000000000105" {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "Provider 不存在", Status: 404})
		return
	}
	var body struct {
		Enabled *bool `json:"enabled"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Enabled != nil {
		s.mu.Lock()
		s.providerEnabled = *body.Enabled
		s.mu.Unlock()
	}
	ok(w, s.snapshot())
}

func decode(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 8<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "请求格式无效", Status: 400}
	}
	return nil
}
func respond(w http.ResponseWriter, data any, err error) {
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, data)
}
func ok(w http.ResponseWriter, data any) { writeJSON(w, 200, map[string]any{"data": data}) }
func writeError(w http.ResponseWriter, err error) {
	code, message, status := "UNKNOWN", "服务暂时不可用", 500
	switch typed := err.(type) {
	case *auth.Error:
		code, message, status = typed.Code, typed.Message, typed.Status
	case *generation.APIError:
		code, message, status = typed.Code, typed.Message, typed.Status
	}
	writeJSON(w, status, map[string]any{"code": code, "message": message})
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func mimeForKey(key string) string {
	switch strings.ToLower(filepath.Ext(key)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	default:
		return "image/png"
	}
}
