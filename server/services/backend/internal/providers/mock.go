package providers

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"strings"
	"time"
)

// Mock is a local generator for integration work. It exercises the real task,
// credit and asset pipeline without calling a paid provider.
type Mock struct {
	Delay time.Duration
}

func (m *Mock) Generate(ctx context.Context, input ImageRequest) (ImageResult, error) {
	if strings.TrimSpace(input.Prompt) == "" {
		return ImageResult{}, &Error{"INVALID_REQUEST", "Prompt is required", false, 400}
	}
	if m.Delay > 0 {
		select {
		case <-time.After(m.Delay):
		case <-ctx.Done():
			return ImageResult{}, ctx.Err()
		}
	}

	const size = 1024
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			// Simple brand-ish gradient so the result is visibly a generated image.
			r := uint8(99 + (x*80)/size)
			g := uint8(91 + (y*60)/size)
			b := uint8(255 - (x*40)/size)
			img.SetRGBA(x, y, color.RGBA{R: r, G: g, B: b, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return ImageResult{}, err
	}
	uri := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
	return ImageResult{ProviderRequestID: fmt.Sprintf("mock-%d", time.Now().UnixNano()), Outputs: []Output{{URI: uri, MediaType: "image/png"}}}, nil
}
