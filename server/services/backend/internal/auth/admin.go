package auth

import (
	"context"
	"encoding/json"
	"net"

	"github.com/jackc/pgx/v5"
)

func (s *Service) HasPermission(ctx context.Context, userID, permission string) (bool, error) {
	var allowed bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1 AND p.code=$2)`, userID, permission).Scan(&allowed)
	return allowed, err
}

func (s *Service) AuditAdmin(ctx context.Context, userID, action, resourceType, resourceID, ip string, before, after any) error {
	previous, err := json.Marshal(before)
	if err != nil {
		return err
	}
	next, err := json.Marshal(after)
	if err != nil {
		return err
	}
	parsed := net.ParseIP(ip)
	var address *string
	if parsed != nil {
		value := parsed.String()
		address = &value
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO admin_audit_logs(actor_user_id,action,resource_type,resource_id,ip,before,after) VALUES($1,$2,$3,$4,$5,$6,$7)`, userID, action, resourceType, resourceID, address, previous, next)
	return err
}

type ProviderStatus struct {
	ID      string
	Enabled bool
}

func (s *Service) ProviderStatuses(ctx context.Context) (map[string]ProviderStatus, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,code,enabled FROM ai_providers WHERE code IN ('antdigital','dashscope')`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	statuses := map[string]ProviderStatus{}
	for rows.Next() {
		var code string
		var status ProviderStatus
		if err = rows.Scan(&status.ID, &code, &status.Enabled); err != nil {
			return nil, err
		}
		statuses[code] = status
	}
	return statuses, rows.Err()
}

func (s *Service) SetProviderEnabled(ctx context.Context, actorID, providerID string, enabled bool, ip string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var previous bool
	err = tx.QueryRow(ctx, `SELECT enabled FROM ai_providers WHERE id=$1 FOR UPDATE`, providerID).Scan(&previous)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &Error{Code: "INVALID_REQUEST", Message: "Provider 不存在", Status: 404}
		}
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE ai_providers SET enabled=$2,updated_at=now() WHERE id=$1`, providerID, enabled)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO admin_audit_logs(actor_user_id,action,resource_type,resource_id,ip,before,after) VALUES($1,'provider.update','provider',$2,nullif($3::text,'')::inet,jsonb_build_object('enabled',$4::boolean),jsonb_build_object('enabled',$5::boolean))`, actorID, providerID, ip, previous, enabled)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Granting roles is intentionally an out-of-band database operation performed
// by the deployment operator. The public registration API never assigns roles.
