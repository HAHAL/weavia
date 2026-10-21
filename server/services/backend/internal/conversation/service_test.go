package conversation

import (
	"context"
	"testing"
)

type fakeStore struct {
	created  Conversation
	messages []Message
}

func (f *fakeStore) Create(_ context.Context, c Conversation) (Conversation, error) {
	c.ID = "c1"
	f.created = c
	return c, nil
}
func (f *fakeStore) List(context.Context, string, int, string) ([]Conversation, error) {
	return []Conversation{f.created}, nil
}
func (f *fakeStore) Get(context.Context, string, string) (Conversation, []Message, error) {
	return f.created, f.messages, nil
}
func (f *fakeStore) Append(_ context.Context, m Message) (Message, error) {
	m.ID = "m1"
	f.messages = append(f.messages, m)
	return m, nil
}

func TestCreateDefaultsAndAppend(t *testing.T) {
	store := &fakeStore{}
	svc := New(store)
	c, err := svc.Create(context.Background(), "u1", "  ", "", "", "")
	if err != nil || c.Title != "新会话" || c.Mode != "image" {
		t.Fatalf("create: %#v %v", c, err)
	}
	msg, err := svc.AppendUserMessage(context.Background(), "u1", "c1", "  hello  ", nil, nil, "m-1")
	if err != nil || msg.Content != "hello" || msg.Role != "user" {
		t.Fatalf("append: %#v %v", msg, err)
	}
}
