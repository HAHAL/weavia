package routing

import (
	"slices"
	"testing"
	"time"
)

func TestSuggestPurposes(t *testing.T) {
	cases := map[string]struct {
		modality string
		cap      string
	}{
		"wan2.7-i2v":                 {"video", "image_to_video"},
		"happyhorse-1.1-r2v":         {"video", "reference_to_video"},
		"wan2.7-videoedit":           {"video", "video_edit"},
		"doubao-seedance-2-5-260628": {"video", "image_to_video"},
		"qwen-image-edit-plus":       {"image", "image_edit"},
		"gpt-image-2.5-sunburst":     {"image", "image_to_image"},
		"wan2.6-t2i":                 {"image", "text_to_image"},
		"qwen-vl-max":                {"text", "vision"},
		"cosyvoice-v2":               {"speech", "tts"},
		"paraformer-realtime-v2":     {"text", "asr"},
		"suno-music-v4":              {"audio", "audio_generation"},
		"deepseek-v3":                {"text", "text_generation"},
	}
	for id, want := range cases {
		modality, caps := SuggestPurposes(id)
		if modality != want.modality || !slices.Contains(caps, want.cap) {
			t.Errorf("%s => %s %v, want %s containing %s", id, modality, caps, want.modality, want.cap)
		}
	}
}

func TestModelReasonAndChannelStatus(t *testing.T) {
	if got := modelReason(ModelHealth{Enabled: true, Bindings: 2, Usable: 1}); got != "single_channel" {
		t.Fatalf("single channel: %s", got)
	}
	if got := modelReason(ModelHealth{Enabled: true, Bindings: 1, Usable: 0, Modality: "video", Providers: []string{"antdigital"}}); got != "video_provider_unsupported" {
		t.Fatalf("video provider: %s", got)
	}
	now := time.Now()
	if got := channelStatus(ChannelHealth{Enabled: true, Keys: 2, EnabledKeys: 0, RejectedKeys: 2}, now); got != "auth_failed" {
		t.Fatalf("auth failed: %s", got)
	}
	later := now.Add(time.Minute)
	if got := channelStatus(ChannelHealth{Enabled: true, Keys: 1, EnabledKeys: 1, Cooldown: &later}, now); got != "cooldown" {
		t.Fatalf("cooldown: %s", got)
	}
}

func TestModelsEndpointAndParse(t *testing.T) {
	if got := ModelsEndpoint("computrix", "https://maas-api.computrix.ai/v1", "https://computrix.ai/v1/models"); got != "https://computrix.ai/v1/models" {
		t.Fatalf("custom models url ignored: %s", got)
	}
	if got := ModelsEndpoint("volcengine", "", ""); got != "https://ark.cn-beijing.volces.com/api/v3/models" {
		t.Fatalf("default endpoint: %s", got)
	}
	if got := ModelsEndpoint("dashscope", "https://dashscope.aliyuncs.com/api/v1", ""); got != "https://dashscope.aliyuncs.com/compatible-mode/v1/models" {
		t.Fatalf("dashscope endpoint: %s", got)
	}
	ids := ParseModelIDs([]byte(`{"data":[{"id":"a"},{"model":"b"},{"id":"a"}],"models":[{"model_name":"c"}]}`))
	if len(ids) != 3 || ids[0] != "a" || ids[1] != "b" || ids[2] != "c" {
		t.Fatalf("parse: %v", ids)
	}
}

func TestDeriveIO(t *testing.T) {
	in, out, primary := DeriveIO([]string{"text_to_image", "image_to_image"})
	if !slices.Equal(in, []string{"text", "image"}) || !slices.Equal(out, []string{"image"}) || primary != "image" {
		t.Fatalf("image model: %v %v %s", in, out, primary)
	}
	in, out, primary = DeriveIO([]string{"vision"})
	if !slices.Equal(in, []string{"text", "image", "video"}) || !slices.Equal(out, []string{"text"}) || primary != "text" {
		t.Fatalf("vision model: %v %v %s", in, out, primary)
	}
	if _, _, primary = DeriveIO([]string{"text_generation", "text_to_image"}); primary != "image" {
		t.Fatalf("media output should win: %s", primary)
	}
	if _, out, primary = DeriveIO([]string{"tts"}); primary != "speech" || !slices.Equal(out, []string{"speech"}) {
		t.Fatalf("tts: %v %s", out, primary)
	}
}
