package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/commercial"
	"github.com/weavia/weavia/services/backend/internal/conversation"
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/invite"
	"github.com/weavia/weavia/services/backend/internal/modelcatalog"
	"github.com/weavia/weavia/services/backend/internal/ops"
	"github.com/weavia/weavia/services/backend/internal/pricing"
	"github.com/weavia/weavia/services/backend/internal/providerconfig"
	"github.com/weavia/weavia/services/backend/internal/quote"
	"github.com/weavia/weavia/services/backend/internal/recipes"
	"github.com/weavia/weavia/services/backend/internal/routing"
	"github.com/weavia/weavia/services/backend/internal/showcase"
	"github.com/weavia/weavia/services/backend/internal/storageconfig"
	"github.com/weavia/weavia/services/backend/internal/workflows"
)

type Server struct {
	Auth                 AuthService
	Commercial           *commercial.Service
	Generation           *generation.Service
	Conversations        *conversation.Service
	Quotes               *quote.Service
	Showcase             *showcase.Service
	Credentials          *providerconfig.Service
	Models               *modelcatalog.Service
	Invites              *invite.Service
	StorageConfig        *storageconfig.Service
	SupportEmail         string
	SupportURL           string
	Pricing              *pricing.Service
	Routing              *routing.Service
	Recipes              *recipes.Service
	Workflows            *workflows.Service
	Assets               *assets.Storage
	AntDigitalConfigured bool
	ComputrixConfigured  bool
	DashScopeConfigured  bool
	RealAIEnabled        bool
	AntDigitalBaseURL    string
	DashScopeBaseURL     string
	Readiness            map[string]func(context.Context) error
	Ops                  *ops.Service
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
	SetAvatar(context.Context, string, string) (auth.User, error)
	ListDevices(context.Context, string) ([]auth.Device, error)
	RevokeDevice(context.Context, string, string) error
	HasPermission(context.Context, string, string) (bool, error)
	AuditAdmin(context.Context, string, string, string, string, string, any, any) error
	ProviderStatuses(context.Context) (map[string]auth.ProviderStatus, error)
	SetProviderEnabled(context.Context, string, string, bool, string) error
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(cors, middleware.RequestID, middleware.Recoverer, middleware.Timeout(3*time.Minute))
	r.Get("/api/health", s.health)
	r.Get("/api/readiness", s.readiness)
	r.Get("/api/plans", s.plans)
	r.Get("/api/ai/models", s.listPlatformModels)
	r.Get("/api/showcase", s.listShowcase)
	r.Get("/api/showcase/images/{showcaseID}", s.showcaseImage)
	r.Get("/api/reference/{token}", s.referenceImage)
	r.Get("/api/reference/{token}/image.png", s.referenceImage)
	r.Get("/api/skills", s.listSkills)
	r.Get("/api/apps", s.listApps)
	r.Post("/api/auth/register", s.register)
	r.Post("/api/auth/registration-requests", s.registrationRequest)
	r.Post("/api/auth/email-verifications/verify", s.verifyRegistration)
	r.Post("/api/auth/email-verifications/resend", s.registrationResend)
	r.Post("/api/auth/password-reset/request", s.passwordResetRequest)
	r.Post("/api/auth/password-reset/confirm", s.passwordResetConfirm)
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
			r.Get("/auth/sessions", s.listSessions)
			r.Get("/features", s.features)
			r.Delete("/auth/sessions/{sessionID}", s.revokeSession)
			r.Post("/auth/sessions/revoke-all", s.revokeAllSessions)
			r.Put("/me/avatar", s.updateAvatar)
			r.Post("/me/deletion-requests", s.requestDeletion)
			r.Get("/me/deletion-requests/current", s.currentDeletion)
			r.Get("/membership", s.membership)
			r.Get("/credits", s.credits)
			r.Get("/credits/transactions", s.creditTransactions)
			r.Post("/workspaces", s.createWorkspace)
			r.Get("/workspaces", s.listWorkspaces)
			r.Get("/projects", s.listProjects)
			r.Get("/assets", s.listAssets)
			r.Get("/assets/{assetID}/preview", s.assetPreview)
			r.Get("/sync/manifest", s.syncManifest)
			r.Get("/my/skills", s.listMySkills)
			r.Post("/skills", s.createSkill)
			r.Post("/skills/{skillID}/runs", s.runSkill)
			r.Post("/apps/{appID}/runs", s.runApp)
			r.Post("/workspaces/{workspaceID}/projects", s.createProject)
			r.Post("/projects/{projectID}/products", s.createProduct)
			r.Post("/products/{productID}/skus", s.createSKU)
			r.Post("/skus/{skuID}/assets", s.createProductAsset)
			r.Get("/skus/{skuID}/assets", s.listProductAssets)
			r.Post("/ai/estimate", s.estimate)
			r.Post("/ai/quotes", s.createQuote)
			r.Get("/ai/templates", s.templates)
			r.Post("/ai/tasks", s.createTask)
			r.Get("/ai/tasks", s.listTasks)
			r.Get("/ai/tasks/{taskID}", s.getTask)
			r.Get("/ai/tasks/{taskID}/outputs/{index}", s.getTaskOutput)
			r.Post("/assets/presign", s.presign)
			r.Post("/conversations", s.createConversation)
			r.Get("/conversations", s.listConversations)
			r.Get("/conversations/{conversationID}", s.getConversation)
			r.Post("/conversations/{conversationID}/messages", s.appendConversationMessage)
		})
	})
	r.Put("/api/assets/upload/{token}", s.upload)
	r.Route("/api/workflows", func(r chi.Router) {
		r.Use(s.requireUser)
		r.Get("/", s.listWorkflows)
		r.Post("/", s.saveWorkflow)
		r.Get("/{workflowID}", s.getWorkflow)
		r.Put("/{workflowID}", s.saveWorkflow)
		r.Delete("/{workflowID}", s.deleteWorkflow)
		r.Get("/{workflowID}/runs", s.listWorkflowRuns)
		r.Post("/{workflowID}/runs", s.startWorkflowRun)
		r.Put("/{workflowID}/runs/{runID}", s.finishWorkflowRun)
	})
	r.Route("/api/admin", func(r chi.Router) {
		r.Use(s.requireUser)
		r.Group(func(r chi.Router) {
			r.Use(s.requirePermission("admin.read"))
			r.Get("/ai/catalog", s.adminCatalog)
			r.Get("/ai/providers", s.adminProviders)
			r.Get("/ai/models", s.adminModels)
			r.Get("/ai/routing", s.adminRouting)
			r.Get("/ai/usage", s.adminUsage)
			r.Get("/skills", s.adminSkills)
			r.Get("/apps", s.adminApps)
			r.Get("/users", s.adminUsers)
			r.Get("/users/{userID}/activity", s.adminUserActivity)
			r.Get("/users/deletion-requests", s.adminDeletionRequests)
			r.Get("/overview", s.adminOverview)
			r.Get("/plans", s.adminPlans)
			r.Get("/orders", s.adminOrders)
			r.Get("/payments", s.adminPayments)
			r.Get("/devices", s.adminDevices)
			r.Get("/credits/transactions", s.adminCreditTransactions)
			r.Get("/tasks", s.adminTasks)
			r.Get("/tasks/{taskID}", s.adminTaskDetail)
			r.Get("/task-runs", s.adminTaskRuns)
			r.Get("/showcase", s.adminListShowcase)
			r.Get("/ai/channels", s.adminChannels)
			r.Get("/pricing", s.adminPricing)
			r.Get("/invites", s.adminInvites)
			r.Get("/storage", s.adminStorage)
			r.Get("/audit-logs", s.adminAuditLogs)
			r.Get("/roles", s.adminRoles)
			r.Get("/users/{userID}/roles", s.adminUserRoles)
			r.Get("/accounts/{accountNo}", s.adminAccountLookup)
			r.Get("/route-groups", s.adminRouteGroups)
			r.Get("/ai/provider-summary", s.adminProviderSummary)
			r.Get("/accounts/{accountNo}/groups", s.adminAccountGroups)
		})
		r.Group(func(r chi.Router) {
			r.Use(s.requirePermission("ops.read"))
			r.Get("/ops/status", s.adminOpsStatus)
			r.Get("/ops/history", s.adminOpsHistory)
			r.Get("/ops/logs/{service}", s.adminOpsLogs)
			r.Get("/ops/tasks/{taskID}/events", s.adminOpsTaskEvents)
		})
		r.With(s.requirePermission("provider.write")).Patch("/ai/providers/{providerID}", s.patchProvider)
		r.With(s.requirePermission("provider.write")).Put("/ai/providers/{providerCode}/credential", s.adminSetProviderCredential)
		r.With(s.requirePermission("provider.write")).Post("/ai/channels", s.adminCreateChannel)
		r.With(s.requirePermission("provider.write")).Post("/ai/models/sync", s.adminSyncModels)
		r.With(s.requirePermission("provider.write")).Post("/ai/tasks/cleanup", s.adminCleanupTasks)
		r.With(s.requirePermission("provider.write")).Patch("/skills/{skillID}", s.adminReviewSkill)
		r.With(s.requirePermission("provider.write")).Patch("/apps/{appID}", s.adminSetAppStatus)
		r.With(s.requirePermission("provider.write")).Patch("/ai/channels/{channelID}", s.adminUpdateChannel)
		r.With(s.requirePermission("provider.write")).Patch("/ai/channels/{channelID}/meta", s.adminUpdateChannelMeta)
		r.With(s.requirePermission("provider.write")).Delete("/ai/channels/{channelID}", s.adminDeleteChannel)
		r.With(s.requirePermission("provider.write")).Put("/ai/channels/{channelID}/key", s.adminSetChannelKey)
		r.With(s.requirePermission("provider.write")).Get("/ai/channels/{channelID}/keys", s.adminListChannelKeys)
		r.With(s.requirePermission("provider.write")).Get("/ai/channels/{channelID}/keys-health", s.adminChannelKeyHealth)
		r.With(s.requirePermission("provider.write")).Patch("/ai/routing/{bindingID}", s.adminUpdateRouting)
		r.With(s.requirePermission("provider.write")).Patch("/ai/channel-keys/{keyID}", s.adminUpdateChannelKey)
		r.With(s.requirePermission("provider.write")).Delete("/ai/channel-keys/{keyID}", s.adminDeleteChannelKey)
		r.With(s.requirePermission("provider.write")).Put("/pricing/settings", s.adminUpdatePricingSettings)
		r.With(s.requirePermission("provider.write")).Put("/pricing/cost/{channelModelID}", s.adminUpdateChannelCost)
		r.With(s.requirePermission("provider.write")).Put("/pricing/model/{logicalModelID}", s.adminUpdateModelPrice)
		r.With(s.requirePermission("provider.write")).Put("/storage", s.adminSaveStorage)
		r.With(s.requirePermission("provider.write")).Post("/storage/test", s.adminTestStorage)
		r.With(s.requirePermission("provider.write")).Post("/storage/migrate", s.adminMigrateStorage)
		r.With(s.requirePermission("provider.write")).Post("/ai/channels/{channelID}/discover", s.adminDiscoverModels)
		r.With(s.requirePermission("provider.write")).Post("/ai/channels/{channelID}/models", s.adminEnableModel)
		r.With(s.requirePermission("provider.write")).Get("/ai/channels/{channelID}/models", s.adminChannelModels)
		r.With(s.requirePermission("provider.write")).Patch("/ai/channel-models/{modelID}", s.adminSetChannelModel)
		r.With(s.requirePermission("provider.write")).Patch("/route-groups/{groupID}", s.adminSetGroupMultiplier)
		r.With(s.requirePermission("provider.write")).Post("/route-groups", s.adminCreateRouteGroup)
		r.With(s.requirePermission("provider.write")).Put("/route-groups/{groupID}/channels", s.adminSetGroupChannels)
		r.With(s.requirePermission("provider.write")).Put("/accounts/{accountNo}/groups", s.adminSetAccountGroups)
		r.With(s.requirePermission("showcase.write")).Post("/showcase", s.adminUploadShowcase)
		r.With(s.requirePermission("showcase.write")).Patch("/showcase/{showcaseID}", s.adminPatchShowcase)
		r.With(s.requirePermission("showcase.write")).Delete("/showcase/{showcaseID}", s.adminDeleteShowcase)
		r.With(s.requirePermission("credits.write")).Post("/credits/adjust", s.adminAdjustCredits)
		r.With(s.requirePermission("users.write")).Patch("/users/{userID}/status", s.adminSetUserStatus)
		r.With(s.requirePermission("users.write")).Put("/users/{userID}/roles", s.adminSetUserRoles)
		r.With(s.requirePermission("users.write")).Post("/invites", s.adminCreateInvite)
		r.With(s.requirePermission("users.write")).Patch("/users/{userID}/oss-sync", s.adminSetOSSSync)
		r.With(s.requirePermission("users.write")).Patch("/invites/{inviteID}", s.adminUpdateInvite)
		r.With(s.requirePermission("users.write")).Post("/users/deletion-requests/{requestID}/approve", s.approveDeletion)
		r.With(s.requirePermission("users.write")).Post("/users/deletion-requests/{requestID}/reject", s.rejectDeletion)
		r.With(s.requirePermission("plans.write")).Patch("/plans/{planID}", s.adminUpdatePlan)
	})
	return r
}

func cors(next http.Handler) http.Handler {
	allowed := map[string]bool{"tauri://localhost": true, "http://tauri.localhost": true, "http://localhost:1420": true, "http://127.0.0.1:1420": true, "http://localhost:3001": true, "http://127.0.0.1:3001": true}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); allowed[origin] || sameHostOrigin(r, origin) {
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

func sameHostOrigin(r *http.Request, origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Hostname() == "" {
		return false
	}
	host := r.Host
	if value, _, splitErr := net.SplitHostPort(host); splitErr == nil {
		host = value
	}
	return strings.EqualFold(parsed.Hostname(), host)
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
func (s *Server) requirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			allowed, err := s.Auth.HasPermission(r.Context(), currentUser(r).ID, permission)
			if err != nil {
				writeError(w, err)
				return
			}
			if !allowed {
				writeError(w, &auth.Error{Code: "FORBIDDEN", Message: "无管理权限", Status: 403})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"service": "weavia-cloud-api", "status": "ok", "version": "0.1.0", "providers": map[string]any{"antdigital": map[string]bool{"configured": s.AntDigitalConfigured}, "dashscope": map[string]bool{"configured": s.DashScopeConfigured}}})
}
func (s *Server) readiness(w http.ResponseWriter, r *http.Request) {
	if len(s.Readiness) == 0 {
		writeJSON(w, 503, map[string]any{"status": "not_ready"})
		return
	}
	checks := map[string]string{}
	ready := true
	for name, check := range s.Readiness {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		err := check(ctx)
		cancel()
		if err != nil {
			checks[name] = "failed"
			ready = false
		} else {
			checks[name] = "ok"
		}
	}
	status := 200
	state := "ready"
	if !ready {
		status = 503
		state = "not_ready"
	}
	writeJSON(w, status, map[string]any{"status": state, "checks": checks})
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
	data, err := s.Auth.Exchange(auth.WithRequestMeta(r.Context(), auth.RequestMeta{IP: clientIP(r), UserAgent: r.UserAgent()}), body.Code, body.State, body.DeviceInfo)
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
func (s *Server) features(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.FeatureFlags(r.Context(), currentUser(r).ID)
	if err == nil {
		data["supportEmail"] = s.SupportEmail
		data["supportUrl"] = s.SupportURL
	}
	respond(w, data, err)
}
func (s *Server) adminSetOSSSync(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Enabled bool `json:"enabled"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	respond(w, map[string]bool{"ok": true}, s.Commercial.SetOSSSync(r.Context(), currentUser(r).ID, chi.URLParam(r, "userID"), input.Enabled))
}
func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email      string          `json:"email"`
		Password   string          `json:"password"`
		Name       string          `json:"name"`
		InviteCode string          `json:"inviteCode"`
		DeviceInfo auth.DeviceInfo `json:"deviceInfo"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	claimID := ""
	if s.Invites != nil && s.Invites.Required() {
		id, err := s.Invites.Claim(r.Context(), body.InviteCode)
		if err != nil {
			writeError(w, err)
			return
		}
		claimID = id
	}
	data, err := s.Auth.Register(r.Context(), body.Email, body.Password, body.Name, body.DeviceInfo)
	if err != nil {
		if claimID != "" && s.Invites != nil {
			_ = s.Invites.Release(r.Context(), claimID)
		}
		slog.Error("register failed", "error", err)
	} else if claimID != "" && s.Invites != nil {
		_ = s.Invites.Bind(r.Context(), data.User.ID, claimID)
	}
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
	data, err := s.Auth.Login(auth.WithRequestMeta(r.Context(), auth.RequestMeta{IP: clientIP(r), UserAgent: r.UserAgent()}), body.Email, body.Password, body.DeviceInfo)
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
func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.ListProjects(r.Context(), currentUser(r).ID)
	respond(w, data, err)
}
func (s *Server) listAssets(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.ListAssets(r.Context(), currentUser(r).ID)
	respond(w, data, err)
}
func (s *Server) assetPreview(w http.ResponseWriter, r *http.Request) {
	preview, err := s.Commercial.GetAssetPreview(r.Context(), currentUser(r).ID, chi.URLParam(r, "assetID"))
	if err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "素材预览不可用", Status: 404})
		return
	}
	var dataURL string
	if preview.Kind == "generated" {
		dataURL, err = s.Assets.GeneratedDataURL(preview.ObjectKey, preview.MimeType)
	} else if strings.HasPrefix(preview.ObjectKey, "references/") || strings.Contains(preview.ObjectKey, "/references/") {
		var found bool
		dataURL, found = s.Assets.DataURL(preview.ObjectKey, preview.MimeType)
		if !found {
			err = fmt.Errorf("asset preview missing")
		}
	} else {
		err = fmt.Errorf("asset preview unavailable")
	}
	if err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "素材预览不可用", Status: 404})
		return
	}
	ok(w, map[string]string{"dataUrl": dataURL})
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
func (s *Server) adminAccountLookup(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AccountLookup(r.Context(), chi.URLParam(r, "accountNo"))
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
func (s *Server) adminTaskDetail(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminTaskDetail(r.Context(), chi.URLParam(r, "taskID"))
	respond(w, data, err)
}
func (s *Server) adminAdjustCredits(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID         string `json:"userId"`
		Amount         int64  `json:"amount"`
		Reason         string `json:"reason"`
		IdempotencyKey string `json:"idempotencyKey"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.UserID == "" || body.Amount == 0 || body.Reason == "" || body.IdempotencyKey == "" {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "调整参数不完整", Status: 400})
		return
	}
	data, err := s.Commercial.Adjust(r.Context(), currentUser(r).ID, body.UserID, body.Amount, body.Reason, body.IdempotencyKey, clientIP(r))
	respond(w, data, err)
}
func (s *Server) adminSetUserStatus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status string `json:"status"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Status != "active" && body.Status != "disabled" {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "用户状态无效", Status: 400})
		return
	}
	err := s.Commercial.AdminSetUserStatus(r.Context(), currentUser(r).ID, chi.URLParam(r, "userID"), body.Status, clientIP(r))
	respond(w, map[string]bool{"updated": err == nil}, err)
}
func (s *Server) adminUpdatePlan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PriceMinor *int  `json:"priceMinor"`
		Enabled    *bool `json:"enabled"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Enabled == nil || body.PriceMinor == nil || *body.PriceMinor < 0 {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "套餐参数无效", Status: 400})
		return
	}
	err := s.Commercial.AdminUpdatePlan(r.Context(), currentUser(r).ID, chi.URLParam(r, "planID"), *body.PriceMinor, *body.Enabled, clientIP(r))
	respond(w, map[string]bool{"updated": err == nil}, err)
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
	data, err := s.Generation.Estimate(r.Context(), currentUser(r), body.Model, body.ImageCount, body.Advanced)
	respond(w, data, err)
}
func (s *Server) templates(w http.ResponseWriter, _ *http.Request) { ok(w, generation.Templates) }
func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	var input generation.Request
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	userID := currentUser(r).ID
	if len(input.ReferenceAssets) > 0 {
		for index, ref := range input.ReferenceAssets {
			if ref.AssetID == "" || ref.ObjectKey == "" || !s.ownsReferenceKey(r.Context(), ref.ObjectKey, userID) || (index == 0 && ref.AssetID != input.InputAssetID) {
				writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "参考素材不属于当前用户", Status: 403})
				return
			}
		}
	}
	if len(input.ReferenceAssets) > 0 && input.ReferenceURL == "" && s.Assets != nil {
		scheme := "http"
		if forwarded := r.Header.Get("X-Forwarded-Proto"); forwarded != "" {
			scheme = forwarded
		}
		host := r.Host
		if forwarded := r.Header.Get("X-Forwarded-Host"); forwarded != "" {
			host = forwarded
		}
		input.ReferenceURL = scheme + "://" + host + "/api/reference/" + s.Assets.Token(input.ReferenceAssets[0].ObjectKey) + "/image.png"
	}
	if input.SKUID != "" {
		if s.Commercial == nil || input.WorkspaceID == "" || input.ProductID == "" || len(input.ReferenceAssets) != 1 {
			writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "商品任务缺少已上传素材", Status: 400})
			return
		}
		allowed, err := s.Commercial.CanGenerate(r.Context(), userID, input.WorkspaceID, input.ProjectID, input.ProductID, input.SKUID, input.InputAssetID, input.ReferenceAssets[0].ObjectKey)
		if err != nil {
			writeError(w, err)
			return
		}
		if !allowed {
			writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "商品素材不可用", Status: 403})
			return
		}
	}
	if input.IdempotencyKey == "" {
		input.IdempotencyKey = r.Header.Get("Idempotency-Key")
	}
	if input.Mode == "" {
		input.Mode = "text_to_image"
	}
	if input.Size == "" {
		input.Size = "1024x1024"
	}
	if input.NumberOfImages == 0 {
		input.NumberOfImages = 1
	}
	if input.QuoteID != "" {
		if s.Quotes == nil {
			writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "报价服务不可用", Status: 503})
			return
		}
		input.IdempotencyKey = "quote-" + input.QuoteID
		if existing, found, err := s.Generation.FindIdempotent(r.Context(), userID, input.IdempotencyKey); err != nil {
			writeError(w, err)
			return
		} else if found {
			ok(w, existing)
			return
		}
		q, err := s.Quotes.ValidateForTask(r.Context(), userID, input.QuoteID, quoteRequestForTask(input))
		if err != nil {
			writeError(w, err)
			return
		}
		input.QuotedCost = &q.TotalCredits
	}
	if s.Pricing != nil {
		if err := s.Pricing.CheckModel(r.Context(), func() string {
			if input.ModelKey != "" {
				return input.ModelKey
			}
			return input.LogicalModel
		}()); err != nil {
			writeError(w, err)
			return
		}
	}
	task, err := s.Generation.Create(r.Context(), currentUser(r), input)
	if err == nil && input.QuoteID != "" && s.Quotes != nil {
		_, _ = s.Quotes.Consume(r.Context(), userID, input.QuoteID)
	}
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
	if err = s.Generation.Deliver(&task); err != nil {
		writeError(w, err)
		return
	}
	ok(w, task)
}
func (s *Server) getTaskOutput(w http.ResponseWriter, r *http.Request) {
	task, found, err := s.Generation.Get(r.Context(), currentUser(r).ID, chi.URLParam(r, "taskID"))
	if err != nil {
		writeError(w, err)
		return
	}
	index, parseErr := strconv.Atoi(chi.URLParam(r, "index"))
	if !found || parseErr != nil || index < 0 || index >= len(task.Outputs) || task.Status != "success" || s.Assets == nil {
		writeError(w, &generation.APIError{Code: "NOT_FOUND", Message: "结果文件不存在", Status: 404})
		return
	}
	output := task.Outputs[index]
	w.Header().Set("Content-Type", output.MimeType)
	if err := s.Assets.ServeGenerated(w, r, output.ObjectKey, output.MimeType); err != nil {
		writeError(w, &generation.APIError{Code: "NOT_FOUND", Message: "结果文件不存在", Status: 404})
		return
	}
}

// ownsReferenceKey 兼容旧的 references/{userID}/ 与新布局 {accountNo}/references/。
func (s *Server) ownsReferenceKey(ctx context.Context, key, userID string) bool {
	if strings.HasPrefix(key, "references/"+userID+"/") {
		return true
	}
	dir := s.Assets.AccountDir(ctx, userID)
	return dir != "" && strings.HasPrefix(key, dir+"/references/")
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
	if dir := s.Assets.AccountDir(r.Context(), currentUser(r).ID); dir != "" {
		objectKey = fmt.Sprintf("%s/references/%s.%s", dir, body.AssetID, ext)
	}
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

func (s *Server) providers(ctx context.Context) ([]generation.Provider, error) {
	statuses, err := s.Auth.ProviderStatuses(ctx)
	if err != nil {
		return nil, err
	}
	credentials := map[string]providerconfig.Status{}
	if s.Credentials != nil {
		if credentials, err = s.Credentials.Statuses(ctx); err != nil {
			return nil, err
		}
	}
	timestamp := time.Unix(0, 0).UTC().Format(time.RFC3339)
	antCred := credentials["antdigital"]
	dashCred := credentials["dashscope"]
	return []generation.Provider{
		{ID: statuses["antdigital"].ID, Code: "antdigital", Name: "Ant Digital MaaS", Type: "openai-compatible", BaseURL: s.AntDigitalBaseURL, Enabled: statuses["antdigital"].Enabled && s.RealAIEnabled, Configured: s.AntDigitalConfigured || antCred.Configured, KeyLast4: antCred.Last4, CreatedAt: timestamp, UpdatedAt: timestamp, ModelCount: 2},
		{ID: statuses["dashscope"].ID, Code: "dashscope", Name: "Alibaba Cloud Model Studio", Type: "dashscope-multimodal", BaseURL: s.DashScopeBaseURL, Enabled: statuses["dashscope"].Enabled && s.RealAIEnabled, Configured: s.DashScopeConfigured || dashCred.Configured, KeyLast4: dashCred.Last4, CreatedAt: timestamp, UpdatedAt: timestamp, ModelCount: 1},
	}, nil
}
func (s *Server) snapshot(ctx context.Context) (map[string]any, error) {
	providers, err := s.providers(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]any{"providers": providers, "models": generation.Models, "logicalModels": generation.LogicalModels, "bindings": generation.Bindings, "usage": []any{}, "estimatedCost": 0}, nil
}
func (s *Server) adminCatalog(w http.ResponseWriter, r *http.Request) {
	data, err := s.snapshot(r.Context())
	respond(w, data, err)
}
func (s *Server) adminProviders(w http.ResponseWriter, r *http.Request) {
	data, err := s.providers(r.Context())
	respond(w, data, err)
}
func (s *Server) adminModels(w http.ResponseWriter, r *http.Request) {
	platform := []modelcatalog.Model{}
	if s.Models != nil {
		if items, err := s.Models.List(r.Context()); err == nil {
			platform = items
		}
	}
	ok(w, map[string]any{"providerModels": generation.Models, "logicalModels": generation.LogicalModels, "platformModels": platform})
}

func (s *Server) listPlatformModels(w http.ResponseWriter, r *http.Request) {
	modality := r.URL.Query().Get("modality")
	if s.Routing != nil {
		items, err := s.Routing.List(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		out := make([]map[string]any, 0, len(items))
		for _, item := range items {
			if modality != "" && item.Modality != modality {
				continue
			}
			out = append(out, map[string]any{"id": item.Key, "key": item.Key, "displayName": item.DisplayName, "icon": item.Icon, "modality": item.Modality, "capabilities": item.Capabilities, "creditsCost": item.CreditsCost, "params": item.Params, "channels": item.Channels, "available": item.Available && s.RealAIEnabled})
		}
		ok(w, map[string]any{"items": out})
		return
	}
	if s.Models == nil {
		ok(w, map[string]any{"items": []modelcatalog.Model{}})
		return
	}
	items, err := s.Models.List(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	filtered := make([]modelcatalog.Model, 0, len(items))
	for _, item := range items {
		if modality == "" || item.Modality == modality {
			item.Available = item.Available && s.RealAIEnabled
			filtered = append(filtered, item)
		}
	}
	ok(w, map[string]any{"items": filtered})
}
func (s *Server) adminRouting(w http.ResponseWriter, r *http.Request) {
	items, err := s.Routing.ListAbilities(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"logicalModels": generation.LogicalModels, "bindings": items})
}
func (s *Server) adminUpdateRouting(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Priority *int  `json:"priority"`
		Weight   *int  `json:"weight"`
		Enabled  *bool `json:"enabled"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	bindingID := chi.URLParam(r, "bindingID")
	before, _ := s.Routing.GetAbility(r.Context(), bindingID)
	if err := s.Routing.UpdateAbility(r.Context(), bindingID, body.Priority, body.Weight, body.Enabled); err != nil {
		writeError(w, err)
		return
	}
	after, _ := s.Routing.GetAbility(r.Context(), bindingID)
	_ = s.Commercial.RecordAdminAudit(r.Context(), currentUser(r).ID, "routing.update", "logical_model_ability", bindingID, clientIP(r),
		map[string]any{"priority": before.Priority, "weight": before.Weight, "enabled": before.Enabled},
		map[string]any{"priority": after.Priority, "weight": after.Weight, "enabled": after.Enabled})
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) adminAuditLogs(w http.ResponseWriter, r *http.Request) {
	items, err := s.Commercial.AdminAuditLogs(r.Context(), 100)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}
func (s *Server) adminUsage(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminUsage(r.Context())
	if err != nil {
		respond(w, nil, err)
		return
	}
	var estimatedCost float64
	for _, item := range data {
		estimatedCost += item.EstimatedCost
	}
	ok(w, map[string]any{"usage": data, "estimatedCost": estimatedCost})
}
func (s *Server) patchProvider(w http.ResponseWriter, r *http.Request) {
	providerID := chi.URLParam(r, "providerID")
	var body struct {
		Enabled *bool `json:"enabled"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Enabled == nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "缺少 enabled", Status: 400})
		return
	}
	if err := s.Auth.SetProviderEnabled(r.Context(), currentUser(r).ID, providerID, *body.Enabled, clientIP(r)); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.snapshot(r.Context())
	respond(w, data, err)
}
func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		for _, candidate := range strings.Split(forwarded, ",") {
			if value := strings.TrimSpace(candidate); net.ParseIP(value) != nil {
				return value
			}
		}
	}
	if real := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(real) != nil {
		return real
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return ip
	}
	if net.ParseIP(r.RemoteAddr) != nil {
		return r.RemoteAddr
	}
	return ""
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
	var authErr *auth.Error
	if errors.As(err, &authErr) {
		code, message, status = authErr.Code, authErr.Message, authErr.Status
	} else {
		switch typed := err.(type) {
		case *generation.APIError:
			code, message, status = typed.Code, typed.Message, typed.Status
		}
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
