package assets

import (
	"context"
	"io"
)

// BlobStore 是对象存储的最小接口；OSS 与本地磁盘都按对象键读写。
type BlobStore interface {
	Put(ctx context.Context, key string, data []byte, contentType string) error
	Stat(ctx context.Context, key string) (int64, error)
	Get(ctx context.Context, key string) (io.ReadCloser, int64, error)
	Delete(ctx context.Context, key string) error
	Health(ctx context.Context) error
}

// UseBlob 切换对象存储；传 nil 回到本地磁盘。
func (s *Storage) UseBlob(blob BlobStore) { s.blob = blob }

func (s *Storage) BlobEnabled() bool { return s.blob != nil }
