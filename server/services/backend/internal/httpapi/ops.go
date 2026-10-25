package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

func (s *Server) adminOpsStatus(w http.ResponseWriter, r *http.Request) {
	if s.Ops == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"status": "unknown"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	checks := map[string]string{"api": "ok"}
	for _, name := range []string{"database", "queue", "storage"} {
		check := s.Readiness[name]
		if check == nil {
			checks[name] = "unknown"
			continue
		}
		checkCtx, stop := context.WithTimeout(ctx, 2*time.Second)
		if check(checkCtx) != nil {
			checks[name] = "failed"
		} else {
			checks[name] = "ok"
		}
		stop()
	}
	queue, queueErr := s.Ops.Queue(ctx)
	channels, channelErr := s.Ops.Channels(ctx)
	host, hostErr := s.Ops.Host()
	state := "ok"
	if checks["database"] == "failed" || checks["storage"] == "failed" || checks["queue"] == "failed" {
		state = "down"
	}
	if queueErr != nil {
		state = "down"
		checks["worker"] = "unknown"
	} else if queue.WorkerLastSeen == nil || time.Since(*queue.WorkerLastSeen) > 90*time.Second {
		checks["worker"] = "down"
		if queue.Waiting > 0 {
			state = "down"
		} else if state == "ok" {
			state = "degraded"
		}
	} else {
		checks["worker"] = "ok"
		if queue.OldestWaitSeconds > 300 && state == "ok" {
			state = "degraded"
		}
	}
	if channelErr == nil {
		for _, c := range channels {
			if c.Calls >= 3 && c.Failures == c.Calls && state == "ok" {
				state = "degraded"
			}
		}
	}
	hostStatus := "unknown"
	if hostErr == nil && host != nil && time.Since(host.CapturedAt) < 3*time.Minute && time.Until(host.CapturedAt) < time.Minute {
		hostStatus = "ok"
	}
	checks["host"] = hostStatus
	if hostStatus == "unknown" && state == "ok" {
		state = "unknown"
	}
	if hostStatus == "ok" {
		if (host.MemoryTotal > 0 && float64(host.MemoryUsed)/float64(host.MemoryTotal) >= .85) ||
			(host.DiskTotal > 0 && float64(host.DiskUsed)/float64(host.DiskTotal) >= .85) {
			checks["host"] = "degraded"
			if state == "ok" {
				state = "degraded"
			}
		}
		for _, container := range host.Containers {
			if container.State != "running" || container.Health == "unhealthy" {
				checks["containers"] = "degraded"
				if state == "ok" {
					state = "degraded"
				}
			}
		}
		if checks["containers"] == "" {
			checks["containers"] = "ok"
		}
	} else {
		checks["containers"] = "unknown"
	}
	writeJSON(w, 200, map[string]any{"status": state, "checks": checks, "queue": queue, "channels": channels,
		"host": host, "hostStatus": hostStatus, "checkedAt": time.Now().UTC(), "channelsAvailable": channelErr == nil})
}

func (s *Server) adminOpsTaskEvents(w http.ResponseWriter, r *http.Request) {
	if s.Ops == nil {
		writeJSON(w, 503, map[string]any{"items": []any{}})
		return
	}
	items, err := s.Ops.Events(r.Context(), chi.URLParam(r, "taskID"))
	respond(w, map[string]any{"items": items}, err)
}

func (s *Server) adminOpsHistory(w http.ResponseWriter, r *http.Request) {
	if s.Ops == nil {
		writeJSON(w, 200, map[string]any{"items": []any{}})
		return
	}
	items, err := s.Ops.History(r.URL.Query().Get("period"))
	respond(w, map[string]any{"items": items}, err)
}

func (s *Server) adminOpsLogs(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "service")
	if name != "backend" && name != "worker" && name != "admin" && name != "postgres" {
		writeJSON(w, 400, map[string]any{"message": "不支持该服务"})
		return
	}
	if s.Ops == nil {
		writeJSON(w, 503, map[string]any{"items": []any{}})
		return
	}
	snapshot, err := s.Ops.Host()
	if err != nil {
		respond(w, nil, err)
		return
	}
	if snapshot == nil || time.Since(snapshot.CapturedAt) > 3*time.Minute {
		writeJSON(w, 200, map[string]any{"items": []any{}, "stale": true})
		return
	}
	items := snapshot.Logs[name]
	if len(items) > 200 {
		items = items[len(items)-200:]
	}
	writeJSON(w, 200, map[string]any{"items": items, "stale": false, "capturedAt": snapshot.CapturedAt})
}
