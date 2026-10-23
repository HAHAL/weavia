package routing

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/modelcatalog"
	"github.com/weavia/weavia/services/backend/internal/providerconfig"
	"github.com/weavia/weavia/services/backend/internal/providers"
)

type Logical struct {
	Key          string         `json:"key"`
	DisplayName  string         `json:"displayName"`
	Icon         string         `json:"icon"`
	Modality     string         `json:"modality"`
	Capabilities []string       `json:"capabilities"`
	CreditsCost  int64          `json:"creditsCost"`
	Params       map[string]any `json:"params"`
	Channels     int            `json:"channels"`
	Available    bool           `json:"available"`
}

type Binding struct {
	ID              string
	ChannelID       string
	ChannelModelID  string
	ChannelName     string
	Provider        string
	ProviderModelID string
	BaseURL         string
	APIKey          string
	Priority        int
	Weight          int
}

type Service struct {
	pool *pgxpool.Pool
	keys *providerconfig.Service
	now  func() time.Time
}

func New(pool *pgxpool.Pool, keys *providerconfig.Service) *Service {
	return &Service{pool: pool, keys: keys, now: time.Now}
}

func (s *Service) List(ctx context.Context) ([]Logical, error) {
	rows, err := s.pool.Query(ctx, `SELECT l.key,l.display_name,l.icon,l.modality,l.capabilities,l.credits_cost,l.params,
		count(a.id) FILTER (WHERE a.enabled AND c.enabled AND cm.enabled AND (a.cooldown_until IS NULL OR a.cooldown_until < now()) AND (l.modality <> 'video' OR c.provider_code = 'dashscope') AND EXISTS (SELECT 1 FROM channel_keys k WHERE k.channel_id=c.id AND k.enabled)) AS channels
		FROM logical_models l
		LEFT JOIN logical_model_abilities a ON a.logical_model_id=l.id
		LEFT JOIN channel_models cm ON cm.id=a.channel_model_id
		LEFT JOIN provider_channels c ON c.id=cm.channel_id
		WHERE l.enabled=true
		GROUP BY l.id ORDER BY l.sort_order,l.display_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Logical{}
	for rows.Next() {
		var item Logical
		var capabilities, params []byte
		if err = rows.Scan(&item.Key, &item.DisplayName, &item.Icon, &item.Modality, &capabilities, &item.CreditsCost, &params, &item.Channels); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(capabilities, &item.Capabilities)
		_ = json.Unmarshal(params, &item.Params)
		item.Available = item.Channels > 0 && (item.Modality != "video" || slices.Contains(item.Capabilities, "text_to_video"))
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Service) Bindings(ctx context.Context, key string) ([]Binding, error) {
	rows, err := s.pool.Query(ctx, `SELECT a.id::text,c.id::text,cm.id::text,c.name,c.provider_code,cm.provider_model_id,coalesce(c.base_url,''),a.priority,a.weight
		FROM logical_models l
		JOIN logical_model_abilities a ON a.logical_model_id=l.id
		JOIN channel_models cm ON cm.id=a.channel_model_id
		JOIN provider_channels c ON c.id=cm.channel_id
		WHERE l.key=$1 AND EXISTS (SELECT 1 FROM channel_keys k WHERE k.channel_id=c.id AND k.enabled) AND l.enabled=true AND a.enabled=true AND c.enabled=true AND cm.enabled=true AND (l.modality <> 'video' OR c.provider_code = 'dashscope')
		  AND (a.cooldown_until IS NULL OR a.cooldown_until < now())
		  AND (c.cooldown_until IS NULL OR c.cooldown_until < now())
		ORDER BY a.priority DESC, a.weight DESC, c.priority DESC, c.weight DESC`, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Binding{}
	for rows.Next() {
		var b Binding
		if err = rows.Scan(&b.ID, &b.ChannelID, &b.ChannelModelID, &b.ChannelName, &b.Provider, &b.ProviderModelID, &b.BaseURL, &b.Priority, &b.Weight); err != nil {
			return nil, err
		}
		if s.keys != nil {
			b.APIKey, _ = s.keys.GetChannelKey(ctx, b.ChannelID)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// BindingsForAccount 在普通绑定之上，把账户所属分组的渠道排到前面；组内无可用渠道时自动回退。
func (s *Service) BindingsForAccount(ctx context.Context, userID, key string) ([]Binding, error) {
	rows, err := s.pool.Query(ctx, `SELECT a.id::text,c.id::text,cm.id::text,c.name,c.provider_code,cm.provider_model_id,coalesce(c.base_url,''),a.priority,a.weight,
		EXISTS (SELECT 1 FROM account_route_groups arg JOIN channel_group_members cgm ON cgm.group_id=arg.group_id WHERE arg.user_id=$2 AND cgm.channel_id=c.id) AS preferred
		FROM logical_models l
		JOIN logical_model_abilities a ON a.logical_model_id=l.id
		JOIN channel_models cm ON cm.id=a.channel_model_id
		JOIN provider_channels c ON c.id=cm.channel_id
		WHERE l.key=$1 AND EXISTS (SELECT 1 FROM channel_keys k WHERE k.channel_id=c.id AND k.enabled) AND l.enabled=true AND a.enabled=true AND c.enabled=true AND cm.enabled=true AND (l.modality <> 'video' OR c.provider_code = 'dashscope')
		  AND (a.cooldown_until IS NULL OR a.cooldown_until < now())
		  AND (c.cooldown_until IS NULL OR c.cooldown_until < now())
		ORDER BY preferred DESC, a.priority DESC, a.weight DESC, c.priority DESC, c.weight DESC`, key, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Binding{}
	for rows.Next() {
		var b Binding
		var preferred bool
		if err = rows.Scan(&b.ID, &b.ChannelID, &b.ChannelModelID, &b.ChannelName, &b.Provider, &b.ProviderModelID, &b.BaseURL, &b.Priority, &b.Weight, &preferred); err != nil {
			return nil, err
		}
		if s.keys != nil {
			b.APIKey, _ = s.keys.GetChannelKey(ctx, b.ChannelID)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// RouteGroup 是后台展示用的分组视图。
type RouteGroup struct {
	ID          string   `json:"id"`
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	IsDefault   bool     `json:"isDefault"`
	Channels    []string `json:"channels"`
	Accounts    int      `json:"accounts"`
}

func (s *Service) ListRouteGroups(ctx context.Context) ([]RouteGroup, error) {
	rows, err := s.pool.Query(ctx, `SELECT g.id::text, g.code, g.name, g.description, g.is_default,
		COALESCE((SELECT array_agg(cgm.channel_id::text) FROM channel_group_members cgm WHERE cgm.group_id=g.id), '{}'),
		(SELECT count(*) FROM account_route_groups arg WHERE arg.group_id=g.id)
		FROM route_groups g ORDER BY g.is_default DESC, g.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RouteGroup{}
	for rows.Next() {
		var g RouteGroup
		if err = rows.Scan(&g.ID, &g.Code, &g.Name, &g.Description, &g.IsDefault, &g.Channels, &g.Accounts); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (s *Service) CreateRouteGroup(ctx context.Context, code, name, description string) (RouteGroup, error) {
	var g RouteGroup
	err := s.pool.QueryRow(ctx, `INSERT INTO route_groups(code,name,description) VALUES($1,$2,$3) RETURNING id::text,code,name,description,is_default`, code, name, description).
		Scan(&g.ID, &g.Code, &g.Name, &g.Description, &g.IsDefault)
	g.Channels = []string{}
	return g, err
}

func (s *Service) SetGroupChannels(ctx context.Context, groupID string, channelIDs []string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `DELETE FROM channel_group_members WHERE group_id=$1`, groupID); err != nil {
		return err
	}
	for _, id := range channelIDs {
		if _, err = tx.Exec(ctx, `INSERT INTO channel_group_members(group_id, channel_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, groupID, id); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Service) ListAccountGroups(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT g.code FROM account_route_groups arg JOIN route_groups g ON g.id=arg.group_id WHERE arg.user_id=$1 ORDER BY arg.priority`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var code string
		if err = rows.Scan(&code); err != nil {
			return nil, err
		}
		out = append(out, code)
	}
	return out, rows.Err()
}

func (s *Service) SetAccountGroups(ctx context.Context, userID string, codes []string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `DELETE FROM account_route_groups WHERE user_id=$1`, userID); err != nil {
		return err
	}
	for i, code := range codes {
		if _, err = tx.Exec(ctx, `INSERT INTO account_route_groups(user_id, group_id, priority) SELECT $1, id, $3 FROM route_groups WHERE code=$2 ON CONFLICT DO NOTHING`, userID, code, i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Service) RecordResult(ctx context.Context, bindingID string, failure error) {
	var abilityID, channelID, channelModelID, key string
	var priority, weight int
	err := s.pool.QueryRow(ctx, `SELECT a.id::text,c.id::text,cm.id::text,l.key,a.priority,a.weight
		FROM logical_model_abilities a JOIN channel_models cm ON cm.id=a.channel_model_id
		JOIN provider_channels c ON c.id=cm.channel_id JOIN logical_models l ON l.id=a.logical_model_id
		WHERE a.id=$1`, bindingID).Scan(&abilityID, &channelID, &channelModelID, &key, &priority, &weight)
	if err != nil {
		return
	}
	if failure == nil {
		_, _ = s.pool.Exec(ctx, `UPDATE logical_model_abilities SET health='healthy',failure_count=0,cooldown_until=NULL,last_error=NULL,updated_at=now() WHERE id=$1`, abilityID)
		_, _ = s.pool.Exec(ctx, `UPDATE provider_channels SET consecutive_failures=0,cooldown_until=NULL,last_error=NULL,updated_at=now() WHERE id=$1`, channelID)
		_, _ = s.pool.Exec(ctx, `INSERT INTO model_route_logs(task_id,logical_model_key,channel_id,channel_model_id,provider_model_id,attempt,status) SELECT NULL,$1,$2,$3,$4,1,'success'`, key, channelID, channelModelID, "")
		return
	}
	if !Retryable(failure) {
		return
	}
	_, _ = s.pool.Exec(ctx, `UPDATE logical_model_abilities SET failure_count=failure_count+1,health=CASE WHEN failure_count+1 >= 3 THEN 'cooldown' ELSE 'degraded' END,cooldown_until=CASE WHEN failure_count+1 >= 3 THEN now()+interval '60 seconds' ELSE cooldown_until END,last_error=$2,updated_at=now() WHERE id=$1`, abilityID, failure.Error())
	_, _ = s.pool.Exec(ctx, `UPDATE provider_channels SET consecutive_failures=consecutive_failures+1,cooldown_until=CASE WHEN consecutive_failures+1 >= failure_threshold THEN now()+make_interval(secs=>cooldown_seconds) ELSE cooldown_until END,last_error=$2,updated_at=now() WHERE id=$1`, channelID, failure.Error())
}

func Retryable(err error) bool {
	if err == nil {
		return false
	}
	var pe *providers.Error
	if errors.As(err, &pe) {
		if pe.Retryable {
			return true
		}
		switch pe.Status {
		case 408, 425, 429, 500, 502, 503, 504:
			return true
		}
	}
	return false
}

func (s *Service) LogAttempt(ctx context.Context, taskID, key, channelID, channelModelID, providerModelID string, attempt int, status, errorCode string, latency time.Duration) {
	_, _ = s.pool.Exec(ctx, `INSERT INTO model_route_logs(task_id,logical_model_key,channel_id,channel_model_id,provider_model_id,attempt,status,error_code,latency_ms) VALUES(nullif($1,'')::uuid,$2,nullif($3,'')::uuid,nullif($4,'')::uuid,$5,$6,$7,$8,$9)`, taskID, key, channelID, channelModelID, providerModelID, attempt, status, errorCode, latency.Milliseconds())
}

func (s *Service) Lookup(ctx context.Context, key string) (Logical, error) {
	var item Logical
	var caps, params []byte
	err := s.pool.QueryRow(ctx, `SELECT key,display_name,icon,modality,capabilities,credits_cost,params,enabled FROM logical_models WHERE key=$1`, key).Scan(&item.Key, &item.DisplayName, &item.Icon, &item.Modality, &caps, &item.CreditsCost, &params, &item.Available)
	if errors.Is(err, pgx.ErrNoRows) {
		return item, errors.New("logical model not found")
	}
	if err != nil {
		return item, err
	}
	_ = json.Unmarshal(caps, &item.Capabilities)
	_ = json.Unmarshal(params, &item.Params)
	return item, nil
}

type Channel struct {
	ID                 string     `json:"id"`
	ProviderCode       string     `json:"providerCode"`
	Name               string     `json:"name"`
	BaseURL            string     `json:"baseUrl"`
	Priority           int        `json:"priority"`
	Weight             int        `json:"weight"`
	Enabled            bool       `json:"enabled"`
	AutoDisable        bool       `json:"autoDisable"`
	FailureThreshold   int        `json:"failureThreshold"`
	CooldownSeconds    int        `json:"cooldownSeconds"`
	ConsecutiveFailure int        `json:"consecutiveFailures"`
	CooldownUntil      *time.Time `json:"cooldownUntil,omitempty"`
	KeyLast4           string     `json:"keyLast4,omitempty"`
	ModelCount         int        `json:"modelCount"`
}

func (s *Service) ListChannels(ctx context.Context) ([]Channel, error) {
	rows, err := s.pool.Query(ctx, `SELECT c.id::text,c.provider_code,c.name,c.base_url,c.priority,c.weight,c.enabled,c.auto_disable,c.failure_threshold,c.cooldown_seconds,c.consecutive_failures,c.cooldown_until,
		coalesce((SELECT key_last4 FROM channel_keys k WHERE k.channel_id=c.id ORDER BY k.created_at DESC LIMIT 1),''),
		(SELECT count(*) FROM channel_models cm WHERE cm.channel_id=c.id)
		FROM provider_channels c ORDER BY c.priority DESC,c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Channel{}
	for rows.Next() {
		var c Channel
		if err = rows.Scan(&c.ID, &c.ProviderCode, &c.Name, &c.BaseURL, &c.Priority, &c.Weight, &c.Enabled, &c.AutoDisable, &c.FailureThreshold, &c.CooldownSeconds, &c.ConsecutiveFailure, &c.CooldownUntil, &c.KeyLast4, &c.ModelCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Service) CreateChannel(ctx context.Context, providerCode, name, baseURL, apiKey string, priority, weight int, userID string) (Channel, error) {
	providerCode = strings.ToLower(strings.TrimSpace(providerCode))
	if providerCode != "antdigital" && providerCode != "dashscope" && providerCode != "computrix" {
		return Channel{}, errors.New("unsupported provider")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return Channel{}, errors.New("channel name is required")
	}
	if weight < 0 {
		weight = 1
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Channel{}, err
	}
	defer tx.Rollback(ctx)
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO provider_channels(provider_code,name,base_url,priority,weight) VALUES($1,$2,$3,$4,$5) RETURNING id::text`, providerCode, name, baseURL, priority, weight).Scan(&id)
	if err != nil {
		return Channel{}, err
	}
	// Copy the provider's model set and bindings from an existing channel.
	_, err = tx.Exec(ctx, `INSERT INTO channel_models(channel_id,provider_model_id,display_name,modality,capabilities,params,metadata,enabled,last_synced_at)
		SELECT $1,provider_model_id,display_name,modality,capabilities,params,metadata,true,now()
		FROM channel_models WHERE channel_id=(SELECT id FROM provider_channels WHERE provider_code=$2 AND id<>$1 ORDER BY priority DESC LIMIT 1)
		ON CONFLICT(channel_id,provider_model_id) DO NOTHING`, id, providerCode)
	if err != nil {
		return Channel{}, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO logical_model_abilities(logical_model_id,channel_model_id,priority,weight)
		SELECT l.id,cm.id,$1,$2 FROM logical_models l JOIN channel_models cm ON cm.provider_model_id=l.key WHERE cm.channel_id=$3
		ON CONFLICT(logical_model_id,channel_model_id) DO NOTHING`, priority, weight, id)
	if err != nil {
		return Channel{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Channel{}, err
	}
	if err = s.keys.SetChannelKey(ctx, id, apiKey, userID); err != nil {
		_, _ = s.pool.Exec(ctx, `DELETE FROM provider_channels WHERE id=$1`, id)
		return Channel{}, err
	}
	channels, err := s.ListChannels(ctx)
	if err != nil {
		return Channel{}, err
	}
	for _, channel := range channels {
		if channel.ID == id {
			return channel, nil
		}
	}
	return Channel{}, errors.New("channel not found after create")
}

func (s *Service) UpdateChannel(ctx context.Context, id string, priority, weight *int, enabled *bool) error {
	_, err := s.pool.Exec(ctx, `UPDATE provider_channels SET priority=COALESCE($2,priority),weight=COALESCE($3,weight),enabled=COALESCE($4,enabled),updated_at=now() WHERE id=$1`, id, priority, weight, enabled)
	return err
}

func (s *Service) ListChannelKeys(ctx context.Context, channelID string) ([]providerconfig.ChannelKey, error) {
	return s.keys.ListChannelKeys(ctx, channelID)
}

func (s *Service) UpdateChannelKey(ctx context.Context, keyID string, enabled *bool, weight *int) error {
	return s.keys.UpdateChannelKey(ctx, keyID, enabled, weight)
}

func (s *Service) DeleteChannelKey(ctx context.Context, keyID string) error {
	return s.keys.DeleteChannelKey(ctx, keyID)
}

func (s *Service) SetChannelKey(ctx context.Context, id, apiKey, userID string) error {
	return s.keys.SetChannelKey(ctx, id, apiKey, userID)
}

func (s *Service) SyncCatalog(ctx context.Context, items []modelcatalog.Model) error {
	for _, item := range items {
		if item.Modality != "image" && item.Modality != "video" {
			continue
		}
		channels, err := s.pool.Query(ctx, `SELECT id::text,priority,weight FROM provider_channels WHERE provider_code=$1 AND enabled=true`, item.Provider)
		if err != nil {
			return err
		}
		type channel struct {
			id       string
			priority int
			weight   int
		}
		var list []channel
		for channels.Next() {
			var c channel
			if err = channels.Scan(&c.id, &c.priority, &c.weight); err != nil {
				channels.Close()
				return err
			}
			list = append(list, c)
		}
		channels.Close()
		if len(list) == 0 {
			continue
		}
		credits := int64(50)
		_ = s.pool.QueryRow(ctx, `SELECT coalesce(credit_cost,50) FROM ai_models WHERE model_name=$1 LIMIT 1`, item.ID).Scan(&credits)
		icon := "sparkles"
		if item.ID == "qwen-image-max" {
			icon = "crown"
		}
		if strings.Contains(strings.ToLower(item.ID), "edit") {
			icon = "wand"
		}
		if item.Modality == "video" {
			icon = "video"
		}
		caps, _ := json.Marshal(item.Capabilities)
		params, _ := json.Marshal(map[string]any{"ratios": []string{"1:1", "4:5", "3:4", "16:9", "9:16"}, "resolutions": []string{"1K", "2K"}, "maxCount": 4, "promptExtend": true})
		enabled := true
		var logicalID string
		err = s.pool.QueryRow(ctx, `INSERT INTO logical_models(key,display_name,type,icon,modality,capabilities,credits_cost,params,enabled,sort_order)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,100)
			ON CONFLICT(key) DO UPDATE SET display_name=EXCLUDED.display_name,type=EXCLUDED.type,icon=EXCLUDED.icon,modality=EXCLUDED.modality,capabilities=EXCLUDED.capabilities,params=EXCLUDED.params,enabled=EXCLUDED.enabled,updated_at=now()
			RETURNING id::text`, item.ID, item.DisplayName, item.Modality, icon, item.Modality, caps, credits, params, enabled).Scan(&logicalID)
		if err != nil {
			return err
		}
		for _, c := range list {
			var channelModelID string
			err = s.pool.QueryRow(ctx, `INSERT INTO channel_models(channel_id,provider_model_id,display_name,modality,capabilities,enabled,last_synced_at)
				VALUES($1,$2,$3,$4,$5,true,now())
				ON CONFLICT(channel_id,provider_model_id) DO UPDATE SET display_name=EXCLUDED.display_name,modality=EXCLUDED.modality,capabilities=EXCLUDED.capabilities,last_synced_at=now()
				RETURNING id::text`, c.id, item.ID, item.DisplayName, item.Modality, caps).Scan(&channelModelID)
			if err != nil {
				return err
			}
			_, err = s.pool.Exec(ctx, `INSERT INTO logical_model_abilities(logical_model_id,channel_model_id,priority,weight,enabled)
				VALUES($1,$2,$3,$4,true)
				ON CONFLICT(logical_model_id,channel_model_id) DO UPDATE SET priority=EXCLUDED.priority,weight=EXCLUDED.weight`, logicalID, channelModelID, c.priority, c.weight)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
