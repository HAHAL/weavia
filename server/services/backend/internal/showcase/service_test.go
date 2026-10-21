package showcase

import "testing"

func TestValidateAndDetectMime(t *testing.T) {
	ok := CreateInput{Kind: "image", Title: "香水", Tag: "美妆", Prompt: "p", Status: "published"}
	if err := validate(ok); err != nil {
		t.Fatalf("valid input rejected: %v", err)
	}
	if err := validate(CreateInput{Kind: "bad", Title: "x", Status: "published"}); err == nil {
		t.Fatal("invalid kind accepted")
	}
	if detectMime([]byte{0xff, 0xd8, 0xff, 0x00}) != "image/jpeg" {
		t.Fatal("jpeg not detected")
	}
	if detectMime([]byte("hello")) != "" {
		t.Fatal("text accepted as image")
	}
}
