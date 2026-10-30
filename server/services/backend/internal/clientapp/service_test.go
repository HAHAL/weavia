package clientapp

import (
	"testing"
	"time"
)

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"0.1.0", "0.2.0", -1},
		{"0.10.0", "0.9.9", 1},
		{"1.0.0", "1.0.0", 0},
		{"1.2", "1.2.0", 0},
	}
	for _, c := range cases {
		if got := CompareVersions(c.a, c.b); got != c.want {
			t.Errorf("CompareVersions(%q,%q)=%d want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestValidateAnnouncement(t *testing.T) {
	in := AnnouncementInput{Title: " 维护通知 ", Body: "今晚 23:00 维护"}
	if err := validateAnnouncement(&in); err != nil {
		t.Fatal(err)
	}
	if in.Title != "维护通知" || in.Level != "info" || in.Status != "draft" {
		t.Fatalf("defaults not applied: %+v", in)
	}
	start := time.Now()
	end := start.Add(-time.Hour)
	bad := AnnouncementInput{Title: "x", StartsAt: &start, EndsAt: &end}
	if err := validateAnnouncement(&bad); err == nil {
		t.Fatal("expected window error")
	}
	if err := validateAnnouncement(&AnnouncementInput{Title: "x", Level: "loud"}); err == nil {
		t.Fatal("expected level error")
	}
}
