package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type syncManifest struct {
	Version         string `json:"version"`
	ModelsVersion   string `json:"modelsVersion"`
	SkillsVersion   string `json:"skillsVersion"`
	AppsVersion     string `json:"appsVersion"`
	ShowcaseVersion string `json:"showcaseVersion"`
	TasksVersion    string `json:"tasksVersion"`
	CreditsVersion  string `json:"creditsVersion"`
	ServerTime      string `json:"serverTime"`
}

func (s *Server) syncManifest(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r).ID
	var models, skills, apps, showcase, tasks time.Time
	var creditsVersion int64
	_ = s.Commercial.Pool().QueryRow(r.Context(), `SELECT
		coalesce((SELECT max(updated_at) FROM logical_models),'epoch'),
		coalesce((SELECT max(updated_at) FROM skills),'epoch'),
		coalesce((SELECT max(updated_at) FROM apps),'epoch'),
		coalesce((SELECT max(updated_at) FROM showcase_items),'epoch'),
		coalesce((SELECT max(updated_at) FROM tasks WHERE user_id=$1),'epoch'),
		coalesce((SELECT version FROM credit_accounts WHERE user_id=$1),0)`, userID).Scan(&models, &skills, &apps, &showcase, &tasks, &creditsVersion)
	v := syncManifest{
		ModelsVersion: models.UTC().Format(time.RFC3339Nano), SkillsVersion: skills.UTC().Format(time.RFC3339Nano),
		AppsVersion: apps.UTC().Format(time.RFC3339Nano), ShowcaseVersion: showcase.UTC().Format(time.RFC3339Nano),
		TasksVersion: tasks.UTC().Format(time.RFC3339Nano), CreditsVersion: strconv.FormatInt(creditsVersion, 10),
		ServerTime: time.Now().UTC().Format(time.RFC3339Nano),
	}
	v.Version = manifestETag(v)
	w.Header().Set("ETag", `"`+v.Version+`"`)
	if match := r.Header.Get("If-None-Match"); match != "" && strings.Trim(match, `"`) == v.Version {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	ok(w, v)
}

func manifestETag(v syncManifest) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%s|%s|%s|%s", v.ModelsVersion, v.SkillsVersion, v.AppsVersion, v.ShowcaseVersion, v.TasksVersion, v.CreditsVersion)))
	return hex.EncodeToString(sum[:12])
}
