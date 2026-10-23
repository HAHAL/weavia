package assets

import (
	"context"
	"os"
	"path/filepath"
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

func TestGeneratedAssetReadbackAndUnsafeSources(t *testing.T) {
	storage := New(t.TempDir(), "test-secret")
	key, size, err := storage.SaveGenerated(context.Background(), "", "task-1", 0, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==", "image/png")
	if err != nil || key != "generated/task-1/0.png" || size != 16 {
		t.Fatalf("save: %q %d %v", key, size, err)
	}
	data, err := storage.GeneratedDataURL(key, "image/png")
	if err != nil || !strings.HasPrefix(data, "data:image/png;base64,") {
		t.Fatalf("readback: %v", err)
	}
	if err := os.WriteFile(filepath.Join(storage.Root, filepath.FromSlash(key)), []byte("corrupt"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := storage.VerifyGenerated(key, nil); err == nil {
		t.Fatal("corrupted asset accepted")
	}
	if _, _, err := storage.SaveGenerated(context.Background(), "", "task-2", 0, "https://127.0.0.1/image.png", "image/png"); err == nil {
		t.Fatal("insecure URL accepted")
	}
	if _, _, err := storage.SaveGenerated(context.Background(), "", "../escape", 0, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==", "image/png"); err == nil {
		t.Fatal("unsafe key accepted")
	}
}
