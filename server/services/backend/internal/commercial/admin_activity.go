package commercial

import (
	"context"
	"time"
)

type AdminLoginEvent struct {
	At            time.Time `json:"at"`
	IP            string    `json:"ip"`
	Platform      string    `json:"platform"`
	UserAgent     string    `json:"userAgent"`
	DeviceName    string    `json:"deviceName"`
	AppVersion    string    `json:"appVersion"`
	Success       bool      `json:"success"`
	FailureReason string    `json:"failureReason,omitempty"`
}

type AdminModelRequest struct {
	ID            string    `json:"id"`
	At            time.Time `json:"at"`
	ModelKey      string    `json:"modelKey"`
	ProviderModel string    `json:"providerModel"`
	Provider      string    `json:"provider"`
	Status        string    `json:"status"`
	Credits       int64     `json:"credits"`
	Resolution    string    `json:"resolution,omitempty"`
	Count         int       `json:"count,omitempty"`
}

type AdminConsumption struct {
	ID             string    `json:"id"`
	At             time.Time `json:"at"`
	Type           string    `json:"type"`
	AvailableDelta int64     `json:"availableDelta"`
	ReservedDelta  int64     `json:"reservedDelta"`
	BalanceAfter   int64     `json:"balanceAfter"`
	ReferenceType  string    `json:"referenceType"`
	ReferenceID    string    `json:"referenceId"`
}

type AdminModelUsage struct {
	Model     string `json:"model"`
	Requests  int64  `json:"requests"`
	Credits   int64  `json:"credits"`
	Succeeded int64  `json:"succeeded"`
}

type AdminUserActivity struct {
	User         map[string]any      `json:"user"`
	Summary      map[string]any      `json:"summary"`
	Logins       []AdminLoginEvent   `json:"logins"`
	Requests     []AdminModelRequest `json:"requests"`
	Consumptions []AdminConsumption  `json:"consumptions"`
	Models       []AdminModelUsage   `json:"models"`
	WindowDays   int                 `json:"windowDays"`
}

func (s *Service) AdminUserActivity(ctx context.Context, userID string, days int) (AdminUserActivity, error) {
	if days <= 0 || days > 90 {
		days = 15
	}
	out := AdminUserActivity{WindowDays: days, Logins: []AdminLoginEvent{}, Requests: []AdminModelRequest{}, Consumptions: []AdminConsumption{}, Models: []AdminModelUsage{}}
	var id, email, name, status string
	var created time.Time
	var credits int64
	if err := s.pool.QueryRow(ctx, `SELECT u.id::text,u.email,coalesce(u.name,''),u.status,u.created_at,coalesce(c.available_balance,0) FROM users u LEFT JOIN credit_accounts c ON c.user_id=u.id WHERE u.id=$1`, userID).Scan(&id, &email, &name, &status, &created, &credits); err != nil {
		return out, err
	}
	out.User = map[string]any{"id": id, "email": email, "name": name, "status": status, "createdAt": created, "credits": credits}

	loginRows, err := s.pool.Query(ctx, `SELECT le.login_time,coalesce(host(le.ip_address),''),coalesce(le.platform,''),coalesce(le.user_agent,''),coalesce(d.name,''),coalesce(d.app_version,''),le.success,coalesce(le.failure_reason,'') FROM login_events le LEFT JOIN devices d ON d.id=le.device_id WHERE le.user_id=$1 AND le.login_time >= now()-make_interval(days=>$2) ORDER BY le.login_time DESC LIMIT 300`, userID, days)
	if err != nil {
		return out, err
	}
	var loginCount, successCount int64
	ips := map[string]bool{}
	var lastLogin *time.Time
	for loginRows.Next() {
		var e AdminLoginEvent
		if err = loginRows.Scan(&e.At, &e.IP, &e.Platform, &e.UserAgent, &e.DeviceName, &e.AppVersion, &e.Success, &e.FailureReason); err != nil {
			loginRows.Close()
			return out, err
		}
		out.Logins = append(out.Logins, e)
		loginCount++
		if e.Success {
			successCount++
		}
		if e.IP != "" {
			ips[e.IP] = true
		}
		if lastLogin == nil {
			lastLogin = &e.At
		}
	}
	loginRows.Close()

	requestRows, err := s.pool.Query(ctx, `SELECT id::text,created_at,coalesce(nullif(input->>'modelKey',''),nullif(input->>'logicalModel',''),coalesce(model,'')),coalesce(model,''),coalesce(provider,''),status::text,coalesce(cost,0),coalesce(input->>'resolution',''),coalesce((input->>'numberOfImages')::int,0) FROM tasks WHERE user_id=$1 AND created_at >= now()-make_interval(days=>$2) ORDER BY created_at DESC LIMIT 300`, userID, days)
	if err != nil {
		return out, err
	}
	var requestCount, consumed int64
	var lastRequest *time.Time
	for requestRows.Next() {
		var r AdminModelRequest
		if err = requestRows.Scan(&r.ID, &r.At, &r.ModelKey, &r.ProviderModel, &r.Provider, &r.Status, &r.Credits, &r.Resolution, &r.Count); err != nil {
			requestRows.Close()
			return out, err
		}
		out.Requests = append(out.Requests, r)
		requestCount++
		consumed += r.Credits
		if lastRequest == nil {
			lastRequest = &r.At
		}
	}
	requestRows.Close()

	usageRows, err := s.pool.Query(ctx, `SELECT coalesce(nullif(input->>'modelKey',''),nullif(input->>'logicalModel',''),coalesce(model,'')),count(*),coalesce(sum(cost),0),count(*) FILTER (WHERE status='success') FROM tasks WHERE user_id=$1 AND created_at >= now()-make_interval(days=>$2) GROUP BY 1 ORDER BY 3 DESC`, userID, days)
	if err != nil {
		return out, err
	}
	for usageRows.Next() {
		var u AdminModelUsage
		if err = usageRows.Scan(&u.Model, &u.Requests, &u.Credits, &u.Succeeded); err != nil {
			usageRows.Close()
			return out, err
		}
		out.Models = append(out.Models, u)
	}
	usageRows.Close()

	consumptionRows, err := s.pool.Query(ctx, `SELECT t.id::text,t.created_at,t.type,t.available_delta,t.reserved_delta,t.balance_after,coalesce(t.reference_type,''),coalesce(t.reference_id::text,'') FROM credit_transactions_v1 t JOIN credit_accounts a ON a.id=t.account_id WHERE a.user_id=$1 AND t.created_at >= now()-make_interval(days=>$2) ORDER BY t.created_at DESC LIMIT 300`, userID, days)
	if err != nil {
		return out, err
	}
	for consumptionRows.Next() {
		var c AdminConsumption
		if err = consumptionRows.Scan(&c.ID, &c.At, &c.Type, &c.AvailableDelta, &c.ReservedDelta, &c.BalanceAfter, &c.ReferenceType, &c.ReferenceID); err != nil {
			consumptionRows.Close()
			return out, err
		}
		out.Consumptions = append(out.Consumptions, c)
	}
	consumptionRows.Close()

	out.Summary = map[string]any{
		"logins": loginCount, "successfulLogins": successCount, "uniqueIPs": len(ips),
		"requests": requestCount, "consumedCredits": consumed,
		"lastLoginAt": lastLogin, "lastRequestAt": lastRequest, "credits": credits,
	}
	return out, nil
}
