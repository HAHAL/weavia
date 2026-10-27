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
	var body generation.Request
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Mode == "" {
		body.Mode = "text_to_image"
	}
	if body.Size == "" {
		body.Size = "1024x1024"
	}
	if body.NumberOfImages == 0 {
		body.NumberOfImages = 1
	}
	total, err := s.Generation.Preview(r.Context(), currentUser(r), body)
	if err != nil {
		writeError(w, err)
		return
	}
	key := body.ModelKey
	if key == "" {
		key = body.LogicalModel
	}
	if s.Pricing != nil && key != "" {
		if err = s.Pricing.CheckModel(r.Context(), key); err != nil {
			writeError(w, err)
			return
		}
	}
	q, err := s.Quotes.CreatePriced(r.Context(), currentUser(r).ID, quoteRequestForTask(body), total)
	respond(w, q, err)
}

func quoteRequestForTask(input generation.Request) quote.Request {
	ids := make([]string, 0, len(input.ReferenceAssets))
	for _, ref := range input.ReferenceAssets {
		ids = append(ids, ref.AssetID)
	}
	return quote.Request{
		ModelKey: input.ModelKey, Resolution: input.Resolution, Duration: input.Duration,
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
