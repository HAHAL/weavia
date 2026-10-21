package auth

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"
)

type registerLogHandler struct {
	message string
	attrs   map[string]any
}

func (h *registerLogHandler) Enabled(context.Context, slog.Level) bool { return true }
func (h *registerLogHandler) WithGroup(string) slog.Handler            { return h }
func (h *registerLogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	for _, attr := range attrs {
		h.attrs[attr.Key] = attr.Value.Any()
	}
	return h
}
func (h *registerLogHandler) Handle(_ context.Context, record slog.Record) error {
	h.message = record.Message
	record.Attrs(func(attr slog.Attr) bool {
		h.attrs[attr.Key] = attr.Value.Any()
		return true
	})
	return nil
}

func TestRegisterFailurePreservesCauseAndSafeStructuredFields(t *testing.T) {
	previous := slog.Default()
	handler := &registerLogHandler{attrs: map[string]any{}}
	slog.SetDefault(slog.New(handler))
	t.Cleanup(func() { slog.SetDefault(previous) })

	cause := errors.New("duplicate key value violates unique constraint")
	service := &Service{}
	err := service.registerFailure(context.Background(), "user_create", cause)
	if !errors.Is(err, cause) {
		t.Fatalf("register error does not preserve cause: %v", err)
	}
	if handler.message != "registration failed" {
		t.Fatalf("unexpected log message: %q", handler.message)
	}
	if handler.attrs["register_step"] != "user_create" {
		t.Fatalf("unexpected register step: %#v", handler.attrs["register_step"])
	}
	if handler.attrs["error_detail"] != cause.Error() {
		t.Fatalf("unexpected error detail: %#v", handler.attrs["error_detail"])
	}
	for _, forbidden := range []string{"password", "token", "secret"} {
		if strings.Contains(strings.ToLower(handler.message), forbidden) {
			t.Fatalf("forbidden credential term in log message: %q", forbidden)
		}
	}
}

func TestLegacyRegisterRequiresEmailVerification(t *testing.T) {
	service := &Service{}
	if _, err := service.Register(context.Background(), "test@example.com", "strongpassword", "", DeviceInfo{}); err == nil {
		t.Fatal("legacy registration bypassed verification")
	}
}
func TestVerificationHashUsesSecret(t *testing.T) {
	a := &Service{verificationSecret: "first"}
	b := &Service{verificationSecret: "second"}
	if a.verificationHash("123456") == b.verificationHash("123456") {
		t.Fatal("verification hash is not keyed")
	}
	if a.verificationHash("123456") == "123456" {
		t.Fatal("code stored in plaintext")
	}
}
