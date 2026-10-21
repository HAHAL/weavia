package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/recipes"
)

func (s *Server) listSkills(w http.ResponseWriter, r *http.Request) {
	if s.Recipes == nil {
		ok(w, map[string]any{"items": []any{}})
		return
	}
	items, err := s.Recipes.ListSkills(r.Context(), "")
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) listMySkills(w http.ResponseWriter, r *http.Request) {
	if s.Recipes == nil {
		ok(w, map[string]any{"items": []any{}})
		return
	}
	items, err := s.Recipes.ListSkills(r.Context(), currentUser(r).ID)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) createSkill(w http.ResponseWriter, r *http.Request) {
	if s.Recipes == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "Skill 服务未初始化", Status: 503})
		return
	}
	var body struct {
		Name        string          `json:"name"`
		Category    string          `json:"category"`
		Description string          `json:"description"`
		Manifest    json.RawMessage `json:"manifest"`
		SourceURL   string          `json:"sourceUrl"`
		License     string          `json:"license"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	item, err := s.Recipes.CreateSkill(r.Context(), currentUser(r).ID, body.Name, body.Category, body.Description, body.SourceURL, body.License, body.Manifest)
	if err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: err.Error(), Status: 400})
		return
	}
	ok(w, item)
}

func (s *Server) listApps(w http.ResponseWriter, r *http.Request) {
	if s.Recipes == nil {
		ok(w, map[string]any{"items": []any{}})
		return
	}
	items, err := s.Recipes.ListApps(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

type recipeRunBody struct {
	Inputs          map[string]string           `json:"inputs"`
	ModelKey        string                      `json:"modelKey"`
	ReferenceAssets []generation.ReferenceAsset `json:"referenceAssets"`
	IdempotencyKey  string                      `json:"idempotencyKey"`
	Params          struct {
		Size         string `json:"size"`
		Resolution   string `json:"resolution"`
		Ratio        string `json:"ratio"`
		PromptExtend *bool  `json:"promptExtend"`
	} `json:"params"`
}

func (s *Server) runSkill(w http.ResponseWriter, r *http.Request) {
	if s.Recipes == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "Skill 服务未初始化", Status: 503})
		return
	}
	var body recipeRunBody
	if err := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20)).Decode(&body); err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "请求体无效", Status: 400})
		return
	}
	skill, err := s.Recipes.GetSkill(r.Context(), chi.URLParam(r, "skillID"), currentUser(r).ID)
	if err != nil {
		writeError(w, &generation.APIError{Code: "NOT_FOUND", Message: "Skill 不存在或未公开", Status: 404})
		return
	}
	prompt, err := recipes.Render(skill.Manifest, body.Inputs)
	if err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: err.Error(), Status: 400})
		return
	}
	s.runRecipe(w, r, body, prompt, skill.ID, "", modelFromManifest(skill.Manifest, "qwen-image-2.0"))
}

func (s *Server) runApp(w http.ResponseWriter, r *http.Request) {
	if s.Recipes == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "应用服务未初始化", Status: 503})
		return
	}
	var body recipeRunBody
	if err := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20)).Decode(&body); err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "请求体无效", Status: 400})
		return
	}
	app, err := s.Recipes.GetApp(r.Context(), chi.URLParam(r, "appID"))
	if err != nil {
		writeError(w, &generation.APIError{Code: "NOT_FOUND", Message: "应用不存在或未发布", Status: 404})
		return
	}
	if app.MediaType == "video" {
		writeError(w, &generation.APIError{Code: "VIDEO_NOT_READY", Message: "视频应用将在阶段 3 开放", Status: 503})
		return
	}
	prompt, err := recipes.Render(app.Manifest, body.Inputs)
	if err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: err.Error(), Status: 400})
		return
	}
	s.runRecipe(w, r, body, prompt, "", app.ID, app.ModelHint)
}

func (s *Server) runRecipe(w http.ResponseWriter, r *http.Request, body recipeRunBody, prompt, skillID, appID, fallbackModel string) {
	modelKey := strings.TrimSpace(body.ModelKey)
	if modelKey == "" {
		modelKey = fallbackModel
	}
	if modelKey == "" {
		modelKey = "qwen-image-2.0"
	}
	idem := body.IdempotencyKey
	if idem == "" {
		idem = randomKey()
	}
	if body.Params.Size == "" {
		body.Params.Size = "1024x1024"
	}
	if body.Params.PromptExtend == nil {
		value := true
		body.Params.PromptExtend = &value
	}
	mode := "text_to_image"
	projectID := ""
	inputAssetID := ""
	referenceURL := ""
	if len(body.ReferenceAssets) > 0 {
		mode = "image_to_image"
		if modelKey == "wanx2.1-imageedit" || modelKey == "qwen-image-edit-plus" {
			mode = "image_edit"
		}
		projectID = "local-assets"
		inputAssetID = body.ReferenceAssets[0].AssetID
		if s.Assets != nil {
			scheme := "http"
			if forwarded := r.Header.Get("X-Forwarded-Proto"); forwarded != "" {
				scheme = forwarded
			}
			host := r.Host
			if forwarded := r.Header.Get("X-Forwarded-Host"); forwarded != "" {
				host = forwarded
			}
			referenceURL = scheme + "://" + host + "/api/reference/" + s.Assets.Token(body.ReferenceAssets[0].ObjectKey) + "/image.png"
		}
	}
	input := generation.Request{IdempotencyKey: idem, ModelKey: modelKey, Prompt: prompt, Mode: mode, ProjectID: projectID, InputAssetID: inputAssetID, ReferenceAssets: body.ReferenceAssets, ReferenceURL: referenceURL, Size: body.Params.Size, Ratio: body.Params.Ratio, Resolution: body.Params.Resolution, PromptExtend: *body.Params.PromptExtend, NumberOfImages: 1, Workflow: "skill_run", SkillID: skillID, AppID: appID}
	task, err := s.Generation.Create(r.Context(), currentUser(r), input)
	respond(w, task, err)
}

func modelFromManifest(raw json.RawMessage, fallback string) string {
	var m struct {
		DefaultModel string `json:"defaultModel"`
	}
	if json.Unmarshal(raw, &m) == nil && m.DefaultModel != "" {
		return m.DefaultModel
	}
	return fallback
}
func randomKey() string { b := make([]byte, 16); _, _ = rand.Read(b); return hex.EncodeToString(b) }

func (s *Server) adminSkills(w http.ResponseWriter, r *http.Request) {
	if s.Recipes == nil {
		ok(w, map[string]any{"items": []any{}})
		return
	}
	items, err := s.Recipes.AdminSkills(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}
func (s *Server) adminApps(w http.ResponseWriter, r *http.Request) {
	if s.Recipes == nil {
		ok(w, map[string]any{"items": []any{}})
		return
	}
	items, err := s.Recipes.AdminApps(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}
func (s *Server) adminReviewSkill(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status   string `json:"status"`
		Featured *bool  `json:"featured"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if err := s.Recipes.ReviewSkill(r.Context(), chi.URLParam(r, "skillID"), body.Status, body.Featured); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) adminSetAppStatus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status string `json:"status"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if err := s.Recipes.SetAppStatus(r.Context(), chi.URLParam(r, "appID"), body.Status); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
