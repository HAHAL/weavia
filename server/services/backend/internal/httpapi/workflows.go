package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type workflowBody struct {
	Name  string          `json:"name"`
	Graph json.RawMessage `json:"graph"`
}

func (s *Server) listWorkflows(w http.ResponseWriter, r *http.Request) {
	if s.Workflows == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "工作流服务未初始化", Status: 503})
		return
	}
	items, err := s.Workflows.List(r.Context(), currentUser(r).ID)
	respond(w, items, err)
}
func (s *Server) saveWorkflow(w http.ResponseWriter, r *http.Request) {
	if s.Workflows == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "工作流服务未初始化", Status: 503})
		return
	}
	var body workflowBody
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Name == "" {
		body.Name = "未命名工作流"
	}
	item, err := s.Workflows.Save(r.Context(), currentUser(r).ID, chi.URLParam(r, "workflowID"), body.Name, body.Graph)
	respond(w, item, err)
}
func (s *Server) getWorkflow(w http.ResponseWriter, r *http.Request) {
	if s.Workflows == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "工作流服务未初始化", Status: 503})
		return
	}
	items, err := s.Workflows.List(r.Context(), currentUser(r).ID)
	if err != nil {
		writeError(w, err)
		return
	}
	id := chi.URLParam(r, "workflowID")
	for _, item := range items {
		if item.ID == id {
			ok(w, item)
			return
		}
	}
	writeError(w, &generation.APIError{Code: "NOT_FOUND", Message: "工作流不存在", Status: 404})
}
func (s *Server) listWorkflowRuns(w http.ResponseWriter, r *http.Request) {
	if s.Workflows == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "工作流服务未初始化", Status: 503})
		return
	}
	items, err := s.Workflows.ListRuns(r.Context(), currentUser(r).ID, chi.URLParam(r, "workflowID"))
	respond(w, items, err)
}
func (s *Server) startWorkflowRun(w http.ResponseWriter, r *http.Request) {
	if s.Workflows == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "工作流服务未初始化", Status: 503})
		return
	}
	var body struct {
		Graph json.RawMessage `json:"graph"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	item, err := s.Workflows.StartRun(r.Context(), currentUser(r).ID, chi.URLParam(r, "workflowID"), body.Graph)
	respond(w, item, err)
}
func (s *Server) finishWorkflowRun(w http.ResponseWriter, r *http.Request) {
	if s.Workflows == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "工作流服务未初始化", Status: 503})
		return
	}
	var body struct {
		Status string          `json:"status"`
		Result json.RawMessage `json:"result"`
		Error  string          `json:"error"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if err := s.Workflows.FinishRun(r.Context(), currentUser(r).ID, chi.URLParam(r, "runID"), body.Status, body.Result, body.Error); err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]bool{"saved": true})
}

func (s *Server) deleteWorkflow(w http.ResponseWriter, r *http.Request) {
	if s.Workflows == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "工作流服务未初始化", Status: 503})
		return
	}
	if err := s.Workflows.Delete(r.Context(), currentUser(r).ID, chi.URLParam(r, "workflowID")); err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]bool{"deleted": true})
}
