package httpapi

import (
	"context"
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
		Model:             quoteModel(input),
		Mode:              input.Mode,
		EditMode:          input.EditMode,
		Prompt:            input.Prompt,
		Size:              input.Size,
		NumberOfImages:    input.NumberOfImages,
		ReferenceAssetIDs: ids,
		MaskAssetID:       input.MaskAssetID,
	}
}

// quoteModel is the model id the client quoted with: the logical key when the
// task was routed by key, else the provider model name.
func quoteModel(input generation.Request) string {
	if input.ModelKey != "" {
		return input.ModelKey
	}
	return input.Model
}

// GenerationPricer prices quotes exactly the way tasks reserve credits.
type GenerationPricer struct{ Generation *generation.Service }

func (p GenerationPricer) Price(ctx context.Context, userID, model string) (quote.ModelPrice, error) {
	unit, caps, err := p.Generation.UnitPrice(ctx, userID, model)
	if err != nil {
		return quote.ModelPrice{}, err
	}
	return quote.ModelPrice{Credits: unit, Enabled: true, Capabilities: caps}, nil
}
