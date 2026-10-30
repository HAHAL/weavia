package httpapi

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/showcase"
)

// adminShowcaseFromTask turns a successful task into a draft template: its
// prompt and parameters plus the first output as the cover. No user data is
// copied besides what the operator sees and edits before publishing.
func (s *Server) adminShowcaseFromTask(w http.ResponseWriter, r *http.Request) {
	if s.Showcase == nil || s.Assets == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "模板服务未初始化", Status: 503})
		return
	}
	var body struct {
		Title string `json:"title"`
		Tag   string `json:"tag"`
	}
	_ = decode(r, &body)
	task, found, err := s.Generation.AdminGet(r.Context(), chi.URLParam(r, "taskID"))
	if err != nil {
		writeError(w, err)
		return
	}
	if !found || task.Status != "success" || len(task.Outputs) == 0 {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "只有成功且有结果的任务可以设为模板", Status: 400})
		return
	}
	output := task.Outputs[0]
	if !strings.HasPrefix(output.MimeType, "image/") {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "暂只支持图片任务设为模板", Status: 400})
		return
	}
	image, err := s.Assets.ReadGenerated(r.Context(), output.ObjectKey)
	if err != nil {
		writeError(w, &generation.APIError{Code: "NOT_FOUND", Message: "任务结果文件不可读", Status: 404})
		return
	}
	prompt := task.Request.DisplayPrompt
	if prompt == "" {
		prompt = task.Request.Prompt
	}
	if runes := []rune(prompt); len(runes) > 2000 {
		prompt = string(runes[:2000])
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		runes := []rune(prompt)
		if len(runes) > 20 {
			runes = runes[:20]
		}
		title = string(runes)
	}
	model := task.Request.ModelKey
	if model == "" {
		model = task.LogicalModel
	}
	item, err := s.Showcase.Create(r.Context(), currentUser(r).ID, showcase.CreateInput{
		Kind: "image", Title: title, Tag: strings.TrimSpace(body.Tag), Prompt: prompt, Status: "draft",
		Media: "image", Model: model, Ratio: task.Request.Ratio, Resolution: task.Request.Resolution, Count: task.Request.NumberOfImages,
	}, image)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, showcaseJSON(item))
}
