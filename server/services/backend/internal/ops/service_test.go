package ops

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSafeCode(t *testing.T) {
	for input, want := range map[string]string{
		"PROVIDER_ERROR":        "PROVIDER_ERROR",
		"":                      "",
		"secret=abcd":           "UNCLASSIFIED",
		strings.Repeat("A", 65): "UNCLASSIFIED",
	} {
		if got := safeCode(input); got != want {
			t.Fatalf("safeCode(%q)=%q want %q", input, got, want)
		}
	}
}

func TestHostAndHistory(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "snapshot.json")
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if err := os.WriteFile(path, []byte(`{"capturedAt":"`+now+`","cpuPercent":9,"containers":[],"logs":{}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	svc := New(nil, path)
	host, err := svc.Host()
	if err != nil || host == nil || host.CPUPercent != 9 {
		t.Fatalf("host=%+v err=%v", host, err)
	}
	row := `{"capturedAt":"` + now + `","cpuPercent":7}` + "\n"
	if err := os.WriteFile(filepath.Join(dir, "metrics.ndjson"), []byte(row), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "metrics-hourly.ndjson"), []byte(row), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, period := range []string{"7d", "30d"} {
		items, err := svc.History(period)
		if err != nil || len(items) != 1 || items[0].CPUPercent != 7 {
			t.Fatalf("history %s=%+v err=%v", period, items, err)
		}
	}
	old := time.Now().UTC().Add(-48 * time.Hour).Format(time.RFC3339Nano)
	if err := os.WriteFile(filepath.Join(dir, "metrics.ndjson"), []byte(`{"capturedAt":"`+old+`","cpuPercent":3}`+"\n"+row), 0o600); err != nil {
		t.Fatal(err)
	}
	items, err := svc.History("24h")
	if err != nil || len(items) != 1 || items[0].CPUPercent != 7 {
		t.Fatalf("24h history=%+v err=%v", items, err)
	}
}
