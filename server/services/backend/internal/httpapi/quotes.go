package httpapi

import (
	"net/http"

	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/quote"
)

func (s *Server) createQuote(w http.ResponseWriter, r *http.Request) {
	if s.Quotes == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "报价服务未初始化", Status: 503})
		return
	}
	var body quote.Request
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	q, err := s.Quotes.Create(r.Context(), currentUser(r).ID, body, r.Header.Get("Idempotency-Key"))
	respond(w, q, err)
}

func quoteRequestForTask(input generation.Request) quote.Request {
	ids := make([]string, 0, len(input.ReferenceAssets))
	for _, ref := range input.ReferenceAssets {
		ids = append(ids, ref.AssetID)
	}
	return quote.Request{
		ConversationID:    input.ConversationID,
		WorkspaceID:       input.WorkspaceID,
		ProjectID:         input.ProjectID,
		Model:             input.Model,
		Mode:              input.Mode,
		EditMode:          input.EditMode,
		Prompt:            input.Prompt,
		Size:              input.Size,
		NumberOfImages:    input.NumberOfImages,
		ReferenceAssetIDs: ids,
		MaskAssetID:       input.MaskAssetID,
	}
}
