package assets

import (
	"strings"
	"testing"
)

func TestUploadTokenCannotBeReusedForeverOrTampered(t *testing.T) {
	storage := New(t.TempDir(), "test-secret")
	token := storage.Token("references/user/image.png")
	key, err := storage.ObjectKey(token)
	if err != nil || key != "references/user/image.png" {
		t.Fatalf("key=%q err=%v", key, err)
	}
	parts := strings.Split(token, ".")
	if _, err = storage.ObjectKey(parts[0] + ".1." + parts[2]); err == nil {
		t.Fatal("expired token accepted")
	}
	if _, err = storage.ObjectKey(parts[0] + "." + parts[1] + ".invalid"); err == nil {
		t.Fatal("tampered token accepted")
	}
}
