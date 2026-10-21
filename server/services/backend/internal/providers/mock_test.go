package providers

import (
	"bytes"
	"context"
	"encoding/base64"
	"image/png"
	"strings"
	"testing"
)

func TestMockReturnsValidPNG(t *testing.T) {
	result, err := (&Mock{}).Generate(context.Background(), ImageRequest{Prompt: "a product photo"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Outputs) != 1 || !strings.HasPrefix(result.Outputs[0].URI, "data:image/png;base64,") {
		t.Fatalf("unexpected output: %+v", result.Outputs)
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(result.Outputs[0].URI, "data:image/png;base64,"))
	if err != nil {
		t.Fatal(err)
	}
	img, err := png.Decode(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	if img.Bounds().Dx() != 1024 || img.Bounds().Dy() != 1024 {
		t.Fatalf("unexpected size: %v", img.Bounds())
	}
}
