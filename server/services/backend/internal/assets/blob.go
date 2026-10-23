package assets

import (
	"context"
	"io"
	"os"
	"path/filepath"
)

// BlobStore 是对象存储的最小接口；OSS 与本地磁盘都按对象键读写。
type BlobStore interface {
	Put(ctx context.Context, key string, data []byte, contentType string) error
	Stat(ctx context.Context, key string) (int64, error)
	Get(ctx context.Context, key string) (io.ReadCloser, int64, error)
	Delete(ctx context.Context, key string) error
	Health(ctx context.Context) error
}

// SetAccountResolver 让存储层把账户 ID 作为对象键的一级目录。
func (s *Storage) SetAccountResolver(fn func(context.Context, string) (string, error)) {
	s.account = fn
}

// AccountDir 返回账户目录名（不含斜杠）；未配置或查询失败时为空，保持旧路径兼容。
func (s *Storage) AccountDir(ctx context.Context, userID string) string {
	if s.account == nil || userID == "" {
		return ""
	}
	value, err := s.account(ctx, userID)
	if err != nil || !safeSegment(value) {
		return ""
	}
	return value
}

// UseBlob 切换对象存储；传 nil 回到本地磁盘。
func (s *Storage) UseBlob(blob BlobStore) { s.blob = blob }

// UseReadThrough 在本地写入模式下，把对象存储当作只读二级存储。
func (s *Storage) UseReadThrough(blob BlobStore) { s.readBlob = blob }

// fetch 依次尝试主对象存储、读穿透存储，最后回退本地磁盘。
func (s *Storage) fetch(ctx context.Context, key string) ([]byte, error) {
	for _, blob := range []BlobStore{s.blob, s.readBlob} {
		if blob == nil {
			continue
		}
		reader, _, err := blob.Get(ctx, key)
		if err != nil {
			continue
		}
		body, readErr := io.ReadAll(reader)
		reader.Close()
		if readErr == nil {
			return body, nil
		}
	}
	return os.ReadFile(filepath.Join(s.Root, filepath.FromSlash(key)))
}

// ReadBlob 返回当前读穿透使用的对象存储。
func (s *Storage) ReadBlob() BlobStore { return s.readBlob }

func (s *Storage) BlobEnabled() bool { return s.blob != nil }
