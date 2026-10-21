package auth

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type RequestMeta struct{ IP, UserAgent string }
type requestMetaKey struct{}

func WithRequestMeta(ctx context.Context, meta RequestMeta) context.Context {
	return context.WithValue(ctx, requestMetaKey{}, meta)
}
func metaFrom(ctx context.Context) RequestMeta {
	m, _ := ctx.Value(requestMetaKey{}).(RequestMeta)
	return m
}
func (s *Service) recordLogin(ctx context.Context, userID, sessionID, platform, reason string, success bool) {
	m := metaFrom(ctx)
	var uid any
	if userID != "" {
		uid = userID
	}
	var sid any
	if sessionID != "" {
		sid = sessionID
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO login_events(user_id,device_id,platform,ip_address,user_agent,success,failure_reason) SELECT $1::uuid,s.device_id,$3,nullif($4::text,'')::inet,$5,$6,$7 FROM (SELECT device_id FROM sessions WHERE id=$2::uuid UNION ALL SELECT NULL::uuid WHERE $2::uuid IS NULL LIMIT 1) s`, uid, sid, platform, m.IP, m.UserAgent, success, reason)
	if err != nil { /* Authentication must not expose audit persistence details. */
	}
}

type SessionView struct {
	ID            string     `json:"id"`
	DeviceID      string     `json:"deviceId"`
	DeviceName    string     `json:"deviceName"`
	Platform      string     `json:"platform"`
	CreatedAt     time.Time  `json:"createdAt"`
	LastActiveAt  *time.Time `json:"lastActiveAt"`
	RevokedAt     *time.Time `json:"revokedAt"`
	RevokedReason *string    `json:"revokedReason"`
	Current       bool       `json:"current"`
}

func (s *Service) ListSessions(ctx context.Context, userID, access string) ([]SessionView, error) {
	rows, err := s.pool.Query(ctx, `SELECT s.id::text,d.device_fingerprint_hash,d.name,d.platform,s.created_at,s.last_active_at,s.revoked_at,s.revoked_reason,s.access_token_hash=$2 FROM sessions s JOIN devices d ON d.id=s.device_id WHERE s.user_id=$1 ORDER BY s.created_at DESC LIMIT 100`, userID, digest(access))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SessionView{}
	for rows.Next() {
		var v SessionView
		if err = rows.Scan(&v.ID, &v.DeviceID, &v.DeviceName, &v.Platform, &v.CreatedAt, &v.LastActiveAt, &v.RevokedAt, &v.RevokedReason, &v.Current); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s *Service) RevokeSession(ctx context.Context, userID, id string) error {
	result, err := s.pool.Exec(ctx, `UPDATE sessions SET revoked_at=coalesce(revoked_at,now()),revoked_reason='user_single_session',updated_at=now() WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return &Error{Code: "SESSION_NOT_FOUND", Message: "会话不存在", Status: 404}
	}
	return nil
}
func (s *Service) RevokeAllSessions(ctx context.Context, userID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at=coalesce(revoked_at,now()),revoked_reason='user_revoke_all',updated_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE devices SET revoked_at=coalesce(revoked_at,now()),updated_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type DeletionRequest struct {
	ID           string     `json:"id"`
	UserID       string     `json:"userId"`
	Status       string     `json:"status"`
	Reason       *string    `json:"reason"`
	RequestedAt  time.Time  `json:"requestedAt"`
	ReviewedAt   *time.Time `json:"reviewedAt"`
	ReviewReason *string    `json:"reviewReason"`
}

func (s *Service) RequestDeletion(ctx context.Context, userID, reason string) (DeletionRequest, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return DeletionRequest{}, err
	}
	defer tx.Rollback(ctx)
	var d DeletionRequest
	err = tx.QueryRow(ctx, `INSERT INTO user_deletion_requests(user_id,reason) VALUES($1,$2) ON CONFLICT(user_id) WHERE status='deletion_requested' DO UPDATE SET user_id=excluded.user_id RETURNING id::text,user_id::text,status,reason,requested_at,reviewed_at,review_reason`, userID, reason).Scan(&d.ID, &d.UserID, &d.Status, &d.Reason, &d.RequestedAt, &d.ReviewedAt, &d.ReviewReason)
	if err != nil {
		return DeletionRequest{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id) VALUES($1,'user.deletion_requested','user_deletion_request',$2)`, userID, d.ID); err != nil {
		return DeletionRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return DeletionRequest{}, err
	}
	return d, nil
}
func (s *Service) CurrentDeletion(ctx context.Context, userID string) (*DeletionRequest, error) {
	var d DeletionRequest
	err := s.pool.QueryRow(ctx, `SELECT id::text,user_id::text,status,reason,requested_at,reviewed_at,review_reason FROM user_deletion_requests WHERE user_id=$1 ORDER BY requested_at DESC LIMIT 1`, userID).Scan(&d.ID, &d.UserID, &d.Status, &d.Reason, &d.RequestedAt, &d.ReviewedAt, &d.ReviewReason)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}
func (s *Service) AdminDeletionRequests(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `SELECT r.id::text,r.status,r.reason,r.requested_at,u.id::text,u.email,u.created_at,coalesce(p.code,'free'),coalesce(s.status::text,'none'),coalesce(c.available_balance,0),coalesce((SELECT count(*) FROM orders o WHERE o.user_id=u.id AND o.status='pending'),0) FROM user_deletion_requests r JOIN users u ON u.id=r.user_id LEFT JOIN LATERAL(SELECT plan_id,status FROM subscriptions WHERE user_id=u.id ORDER BY created_at DESC LIMIT 1)s ON true LEFT JOIN plans p ON p.id=s.plan_id LEFT JOIN credit_accounts c ON c.user_id=u.id WHERE r.status='deletion_requested' ORDER BY r.requested_at LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, status, userID, email, plan, membership string
		var reason *string
		var requested, registered time.Time
		var credits, pending int64
		if err = rows.Scan(&id, &status, &reason, &requested, &userID, &email, &registered, &plan, &membership, &credits, &pending); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "status": status, "reason": reason, "requestedAt": requested, "userId": userID, "email": email, "registeredAt": registered, "plan": plan, "membershipStatus": membership, "credits": credits, "pendingOrders": pending})
	}
	return out, rows.Err()
}
func (s *Service) ReviewDeletion(ctx context.Context, actorID, requestID, decision, reason, ip string) error {
	if strings.TrimSpace(reason) == "" {
		return &Error{Code: "INVALID_REQUEST", Message: "请填写审核理由", Status: 400}
	}
	if decision != "approve" && decision != "reject" {
		return &Error{Code: "INVALID_REQUEST", Message: "审核操作无效", Status: 400}
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var userID string
	var status string
	err = tx.QueryRow(ctx, `SELECT user_id::text,status FROM user_deletion_requests WHERE id=$1 FOR UPDATE`, requestID).Scan(&userID, &status)
	if err == pgx.ErrNoRows {
		return &Error{Code: "REQUEST_NOT_FOUND", Message: "申请不存在", Status: 404}
	}
	if err != nil {
		return err
	}
	if status != "deletion_requested" {
		return &Error{Code: "ALREADY_REVIEWED", Message: "申请已处理", Status: 409}
	}
	if userID == actorID {
		return &Error{Code: "FORBIDDEN", Message: "不能审核自己的注销申请", Status: 403}
	}
	if decision == "approve" {
		var activeTasks int
		if err = tx.QueryRow(ctx, `SELECT count(*) FROM tasks WHERE user_id=$1 AND status NOT IN ('success','failed','cancelled')`, userID).Scan(&activeTasks); err != nil {
			return err
		}
		if activeTasks > 0 {
			return &Error{Code: "ACTIVE_TASKS", Message: "存在未完成任务", Status: 409}
		}
		var pending int
		err = tx.QueryRow(ctx, `SELECT count(*) FROM orders WHERE user_id=$1 AND status='pending'`, userID).Scan(&pending)
		if err != nil {
			return err
		}
		if pending > 0 {
			return &Error{Code: "PENDING_ORDERS", Message: "存在未结订单", Status: 409}
		}
	}
	next := "approved"
	if decision == "reject" {
		next = "rejected"
	}
	if _, err = tx.Exec(ctx, `UPDATE user_deletion_requests SET status=$2,reviewed_at=now(),reviewed_by=$3,review_reason=$4 WHERE id=$1`, requestID, next, actorID, reason); err != nil {
		return err
	}
	if decision == "approve" {
		if _, err = tx.Exec(ctx, `UPDATE users SET status='frozen',name=NULL,avatar_url=NULL,updated_at=now() WHERE id=$1`, userID); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at=coalesce(revoked_at,now()),revoked_reason='deletion_approved',updated_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO data_deletion_jobs(request_id,user_id,approved_by,approved_at,idempotency_key) VALUES($1,$2,$3,now(),$4) ON CONFLICT(request_id) DO NOTHING`, requestID, userID, actorID, "deletion:"+requestID); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,after) VALUES($1,$2,'user_deletion_request',$3,jsonb_build_object('decision',$4::text,'reason',$5::text))`, actorID, "user.deletion_"+next, requestID, next, reason); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO admin_audit_logs(actor_user_id,action,resource_type,resource_id,ip,after) VALUES($1,$2,'user_deletion_request',$3,nullif($4::text,'')::inet,jsonb_build_object('decision',$5::text,'reason',$6::text))`, actorID, "user.deletion_"+next, requestID, ip, next, reason); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
