package assets

import (
	"context"
	"io"
	"strings"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

// OSS 只从服务端访问，且优先走内网 endpoint；客户端统一由 API 代理下载。
type OSS struct {
	client     *oss.Client
	bucket     *oss.Bucket
	bucketName string
	prefix     string
}

type OSSConfig struct {
	Endpoint string
	Bucket   string
	KeyID    string
	Secret   string
	Prefix   string
}

func NewOSS(cfg OSSConfig) (*OSS, error) {
	client, err := oss.New(cfg.Endpoint, cfg.KeyID, cfg.Secret, oss.Timeout(30, 60))
	if err != nil {
		return nil, err
	}
	bucket, err := client.Bucket(cfg.Bucket)
	if err != nil {
		return nil, err
	}
	return &OSS{client: client, bucket: bucket, bucketName: cfg.Bucket, prefix: strings.Trim(cfg.Prefix, "/")}, nil
}

func (o *OSS) key(key string) string {
	if o.prefix == "" {
		return key
	}
	return o.prefix + "/" + key
}

func (o *OSS) Put(ctx context.Context, key string, data []byte, contentType string) error {
	options := []oss.Option{oss.ContentType(contentType), oss.ObjectACL(oss.ACLPrivate)}
	return o.bucket.PutObject(o.key(key), strings.NewReader(string(data)), options...)
}

func (o *OSS) Stat(ctx context.Context, key string) (int64, error) {
	header, err := o.bucket.GetObjectMeta(o.key(key))
	if err != nil {
		return 0, err
	}
	return parseSize(header.Get("Content-Length")), nil
}

func (o *OSS) Get(ctx context.Context, key string) (io.ReadCloser, int64, error) {
	body, err := o.bucket.GetObject(o.key(key))
	if err != nil {
		return nil, 0, err
	}
	size, _ := o.Stat(ctx, key)
	return body, size, nil
}

func (o *OSS) Delete(ctx context.Context, key string) error {
	return o.bucket.DeleteObject(o.key(key))
}

func (o *OSS) Health(ctx context.Context) error {
	_, err := o.client.GetBucketInfo(o.bucketName)
	return err
}

func parseSize(value string) int64 {
	var size int64
	for _, char := range value {
		if char < '0' || char > '9' {
			continue
		}
		size = size*10 + int64(char-'0')
	}
	return size
}
