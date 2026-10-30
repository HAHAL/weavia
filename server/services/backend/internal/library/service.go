// Package library backs up each user's product library so it survives a new
// device. The client stays the editor; the server keeps the latest copy per item.
package library

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Product struct {
	LocalID   string          `json:"localId"`
	Data      json.RawMessage `json:"data"`
	Deleted   bool            `json:"deleted"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

func (s *Service) List(ctx context.Context, userID string) ([]Product, error) {
	rows, err := s.pool.Query(ctx, `SELECT local_id,data,deleted,updated_at FROM user_products WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 2000`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Product{}
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.LocalID, &p.Data, &p.Deleted, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Put stores one product; an older client copy never overwrites a newer one.
func (s *Service) Put(ctx context.Context, userID, localID string, data json.RawMessage, deleted bool, updatedAt time.Time) (Product, error) {
	localID = strings.TrimSpace(localID)
	if localID == "" || len(localID) > 80 {
		return Product{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "商品编号无效", Status: 400}
	}
	if len(data) == 0 || len(data) > 64<<10 || !json.Valid(data) {
		return Product{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "商品数据无效或超过 64KB", Status: 400}
	}
	if updatedAt.IsZero() || updatedAt.After(time.Now().Add(5*time.Minute)) {
		updatedAt = time.Now()
	}
	var p Product
	err := s.pool.QueryRow(ctx, `INSERT INTO user_products(user_id,local_id,data,deleted,updated_at) VALUES($1,$2,$3,$4,$5)
		ON CONFLICT (user_id,local_id) DO UPDATE SET data=EXCLUDED.data,deleted=EXCLUDED.deleted,updated_at=EXCLUDED.updated_at
		WHERE user_products.updated_at <= EXCLUDED.updated_at
		RETURNING local_id,data,deleted,updated_at`, userID, localID, data, deleted, updatedAt).Scan(&p.LocalID, &p.Data, &p.Deleted, &p.UpdatedAt)
	if err != nil {
		// A newer server copy won: report it so the client can adopt it.
		err = s.pool.QueryRow(ctx, `SELECT local_id,data,deleted,updated_at FROM user_products WHERE user_id=$1 AND local_id=$2`, userID, localID).Scan(&p.LocalID, &p.Data, &p.Deleted, &p.UpdatedAt)
	}
	return p, err
}
