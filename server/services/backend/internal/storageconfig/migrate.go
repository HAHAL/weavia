package storageconfig

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/weavia/weavia/services/backend/internal/assets"
)

var errNoStorage = errors.New("object storage is not configured")

type MigrationReport struct {
	Direction     string   `json:"direction"`
	DryRun        bool     `json:"dryRun"`
	Scanned       int      `json:"scanned"`
	Moved         int      `json:"moved"`
	Skipped       int      `json:"skipped"`
	Missing       int      `json:"missing"`
	Bytes         int64    `json:"bytes"`
	UpdatedAssets int      `json:"updatedAssets"`
	UpdatedTasks  int      `json:"updatedTasks"`
	MissingKeys   []string `json:"missingKeys"`
	Errors        []string `json:"errors"`
}

// Migrate 在本地磁盘与 OSS 之间搬移对象，并回写数据库路径。
// direction: "to_oss"（本地→OSS）或 "to_local"（OSS→本地）。
func (s *Service) Migrate(ctx context.Context, storage *assets.Storage, direction string, dryRun bool) (MigrationReport, error) {
	report := MigrationReport{Direction: direction, DryRun: dryRun, MissingKeys: []string{}, Errors: []string{}}
	cfg, secret, err := s.Load(ctx)
	if err != nil {
		return report, err
	}
	if cfg.Bucket == "" || secret == "" {
		return report, errNoStorage
	}
	endpoint := cfg.EndpointInternal
	if endpoint == "" {
		endpoint = cfg.EndpointPublic
	}
	blob, err := assets.NewOSS(assets.OSSConfig{Endpoint: endpoint, Bucket: cfg.Bucket, KeyID: cfg.AccessKeyID, Secret: secret, Prefix: cfg.Prefix})
	if err != nil {
		return report, err
	}

	rows, err := s.pool.Query(ctx, `SELECT a.id::text, COALESCE(u.account_no,''), a.object_key FROM assets a LEFT JOIN users u ON u.id=a.user_id WHERE a.object_key <> '' ORDER BY a.created_at`)
	if err != nil {
		return report, err
	}
	type item struct{ id, account, key string }
	items := []item{}
	for rows.Next() {
		var it item
		if err = rows.Scan(&it.id, &it.account, &it.key); err != nil {
			rows.Close()
			return report, err
		}
		items = append(items, it)
	}
	rows.Close()

	for _, it := range items {
		report.Scanned++
		if it.account == "" {
			report.Skipped++
			continue
		}
		target := ""
		if direction == "to_oss" {
			if strings.HasPrefix(it.key, it.account+"/") {
				report.Skipped++
				continue
			}
			target = it.account + "/" + it.key
		} else {
			prefix := it.account + "/"
			if !strings.HasPrefix(it.key, prefix) {
				report.Skipped++
				continue
			}
			target = strings.TrimPrefix(it.key, prefix)
		}
		data, readErr := s.readObject(ctx, storage, blob, direction, it.key)
		if readErr != nil {
			report.Missing++
			if len(report.MissingKeys) < 20 {
				report.MissingKeys = append(report.MissingKeys, it.key)
			}
			continue
		}
		report.Bytes += int64(len(data))
		if dryRun {
			report.Moved++
			continue
		}
		if err = s.writeObject(ctx, storage, blob, direction, target, data); err != nil {
			report.Errors = append(report.Errors, it.key+": "+err.Error())
			continue
		}
		tag, err := s.pool.Exec(ctx, `UPDATE assets SET object_key=$2 WHERE id=$1`, it.id, target)
		if err != nil {
			report.Errors = append(report.Errors, it.key+": db "+err.Error())
			continue
		}
		if tag.RowsAffected() > 0 {
			report.UpdatedAssets++
		}
		taskTag, err := s.pool.Exec(ctx, `UPDATE tasks SET output = replace(output::text, $1, $2)::jsonb WHERE output::text LIKE '%'||$1||'%'`, it.key, target)
		if err == nil {
			report.UpdatedTasks += int(taskTag.RowsAffected())
		}
		report.Moved++
	}
	return report, nil
}

func (s *Service) readObject(ctx context.Context, storage *assets.Storage, blob assets.BlobStore, direction, key string) ([]byte, error) {
	if direction == "to_oss" {
		return os.ReadFile(filepath.Join(storage.Root, filepath.FromSlash(key)))
	}
	reader, _, err := blob.Get(ctx, key)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

func (s *Service) writeObject(ctx context.Context, storage *assets.Storage, blob assets.BlobStore, direction, key string, data []byte) error {
	if direction == "to_oss" {
		return blob.Put(ctx, key, data, contentTypeFor(key))
	}
	path := filepath.Join(storage.Root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func contentTypeFor(key string) string {
	switch {
	case strings.HasSuffix(key, ".png"):
		return "image/png"
	case strings.HasSuffix(key, ".jpg"), strings.HasSuffix(key, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(key, ".webp"):
		return "image/webp"
	case strings.HasSuffix(key, ".mp4"):
		return "video/mp4"
	}
	return "application/octet-stream"
}
