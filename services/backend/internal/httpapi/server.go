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
	"github.com/weavia/weavia/services/backend/internal/commercial"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Server struct {
	Auth                 AuthService
	Commercial           *commercial.Service
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

type AuthService interface {
	Register(context.Context, string, string, string, auth.DeviceInfo) (auth.SessionResult, error)
	Login(context.Context, string, string, auth.DeviceInfo) (auth.SessionResult, error)
	CreateDesktopSession(context.Context, string) (map[string]any, error)
	Authorize(context.Context, string, string) (map[string]string, error)
	Exchange(context.Context, string, string, auth.DeviceInfo) (auth.SessionResult, error)
	Refresh(context.Context, string) (auth.SessionResult, error)
	Logout(context.Context, string) error
	Me(context.Context, string) (auth.User, error)
	ListDevices(context.Context, string) ([]auth.Device, error)
	RevokeDevice(context.Context, string, string) error
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(cors, middleware.RequestID, middleware.RealIP, middleware.Recoverer, middleware.Timeout(3*time.Minute))
	r.Get("/api/health", s.health)
	r.Get("/api/plans", s.plans)
	r.Post("/api/auth/register", s.register)
	r.Post("/api/auth/login", s.login)
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
			r.Get("/auth/devices", s.listDevices)
			r.Delete("/auth/devices/{deviceID}", s.revokeDevice)
			r.Get("/membership", s.membership)
			r.Get("/credits", s.credits)
			r.Get("/credits/transactions", s.creditTransactions)
			r.Post("/workspaces", s.createWorkspace)
			r.Get("/workspaces", s.listWorkspaces)
			r.Post("/workspaces/{workspaceID}/projects", s.createProject)
			r.Post("/projects/{projectID}/products", s.createProduct)
			r.Post("/products/{productID}/skus", s.createSKU)
			r.Post("/skus/{skuID}/assets", s.createProductAsset)
			r.Get("/skus/{skuID}/assets", s.listProductAssets)
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
	r.Get("/api/admin/users", s.adminUsers)
	r.Get("/api/admin/credits/transactions", s.adminCreditTransactions)
	r.Get("/api/admin/tasks", s.adminTasks)
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
		user, err := s.Auth.Me(r.Context(), strings.TrimPrefix(header, "Bearer "))
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
	data, err := s.Auth.CreateDesktopSession(r.Context(), body.RedirectURI)
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
	userID := ""
	if header := r.Header.Get("Authorization"); strings.HasPrefix(header, "Bearer ") {
		if user, authErr := s.Auth.Me(r.Context(), strings.TrimPrefix(header, "Bearer ")); authErr == nil {
			userID = user.ID
		}
	}
	data, err := s.Auth.Authorize(r.Context(), body.LoginSessionID, userID)
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
	data, err := s.Auth.Exchange(r.Context(), body.Code, body.State, body.DeviceInfo)
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
	data, err := s.Auth.Refresh(r.Context(), body.RefreshToken)
	respond(w, data, err)
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	_ = decode(r, &body)
	_ = s.Auth.Logout(r.Context(), body.RefreshToken)
	ok(w, map[string]bool{"loggedOut": true})
}
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		writeError(w, &auth.Error{Code: "INVALID_TOKEN", Message: "访问令牌缺失", Status: 401})
		return
	}
	user, err := s.Auth.Me(r.Context(), strings.TrimPrefix(header, "Bearer "))
	respond(w, user, err)
}
func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email      string          `json:"email"`
		Password   string          `json:"password"`
		Name       string          `json:"name"`
		DeviceInfo auth.DeviceInfo `json:"deviceInfo"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Auth.Register(r.Context(), body.Email, body.Password, body.Name, body.DeviceInfo)
	respond(w, data, err)
}
func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email      string          `json:"email"`
		Password   string          `json:"password"`
		DeviceInfo auth.DeviceInfo `json:"deviceInfo"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Auth.Login(r.Context(), body.Email, body.Password, body.DeviceInfo)
	respond(w, data, err)
}
func (s *Server) listDevices(w http.ResponseWriter, r *http.Request) {
	data, err := s.Auth.ListDevices(r.Context(), currentUser(r).ID)
	respond(w, data, err)
}
func (s *Server) revokeDevice(w http.ResponseWriter, r *http.Request) {
	err := s.Auth.RevokeDevice(r.Context(), currentUser(r).ID, chi.URLParam(r, "deviceID"))
	respond(w, map[string]bool{"revoked": err == nil}, err)
}
func (s *Server) plans(w http.ResponseWriter, r *http.Request) {
	if s.Commercial == nil {
		ok(w, []any{})
		return
	}
	data, err := s.Commercial.Plans(r.Context())
	respond(w, data, err)
}
func (s *Server) membership(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.Subscription(r.Context(), currentUser(r).ID)
	respond(w, data, err)
}
func (s *Server) credits(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.CreditAccount(r.Context(), currentUser(r).ID)
	respond(w, data, err)
}
func (s *Server) creditTransactions(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.CreditTransactions(r.Context(), currentUser(r).ID, 50)
	respond(w, data, err)
}
func (s *Server) createWorkspace(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name string `json:"name"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Commercial.CreateWorkspace(r.Context(), currentUser(r).ID, b.Name)
	respond(w, data, err)
}
func (s *Server) listWorkspaces(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.ListWorkspaces(r.Context(), currentUser(r).ID)
	respond(w, data, err)
}
func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Commercial.CreateProject(r.Context(), currentUser(r).ID, chi.URLParam(r, "workspaceID"), b.Name, b.Description)
	respond(w, data, err)
}
func (s *Server) createProduct(w http.ResponseWriter, r *http.Request) {
	var b struct {
		WorkspaceID string `json:"workspaceId"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Commercial.CreateProduct(r.Context(), currentUser(r).ID, b.WorkspaceID, chi.URLParam(r, "projectID"), b.Name, b.Description)
	respond(w, data, err)
}
func (s *Server) createSKU(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Code       string         `json:"code"`
		Name       string         `json:"name"`
		Attributes map[string]any `json:"attributes"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.Commercial.CreateSKU(r.Context(), currentUser(r).ID, chi.URLParam(r, "productID"), b.Code, b.Name, b.Attributes)
	respond(w, data, err)
}
func (s *Server) createProductAsset(w http.ResponseWriter, r *http.Request) {
	var b commercial.Asset
	if err := decode(r, &b); err != nil {
		writeError(w, err)
		return
	}
	b.SKUID = chi.URLParam(r, "skuID")
	data, err := s.Commercial.CreateAsset(r.Context(), currentUser(r).ID, b)
	respond(w, data, err)
}
func (s *Server) listProductAssets(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.ListSKUAssets(r.Context(), currentUser(r).ID, chi.URLParam(r, "skuID"))
	respond(w, data, err)
}
func (s *Server) adminUsers(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminUsers(r.Context())
	respond(w, data, err)
}
func (s *Server) adminCreditTransactions(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminCreditTransactions(r.Context())
	respond(w, data, err)
}
func (s *Server) adminTasks(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminTasks(r.Context())
	respond(w, data, err)
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
		WorkspaceID string `json:"workspaceId"`
		ProjectID   string `json:"projectId"`
		ProductID   string `json:"productId"`
		SKUID       string `json:"skuId"`
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
	if body.SKUID != "" && s.Commercial != nil {
		_, err := s.Commercial.CreateAsset(r.Context(), currentUser(r).ID, commercial.Asset{ID: body.AssetID, WorkspaceID: body.WorkspaceID, ProjectID: body.ProjectID, ProductID: body.ProductID, SKUID: body.SKUID, Kind: "source", MimeType: body.ContentType, Size: body.Size, ObjectKey: &objectKey})
		if err != nil {
			writeError(w, err)
			return
		}
	}
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
	objectKey, err := s.Assets.Put(chi.URLParam(r, "token"), body)
	if err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "上传令牌无效", Status: 400})
		return
	}
	if s.Commercial != nil {
		_ = s.Commercial.MarkAssetUploaded(r.Context(), objectKey)
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
