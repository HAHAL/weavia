# WEAVIA Phase 2 Release Deployment Report

Date: 2026-10-12 (Asia/Shanghai)

## 1. Commit

- Release commit: `01e49e9e6c4f322aa08a7edbd0210771af65dffd`
- Commit message: `release: prepare commercial validation phase`
- Deployment method: `git archive` uploaded to the server; the server is not a Git clone.

## 2. Modified files included

The release commit contains the reviewed Phase 1 asset persistence changes, registration audit fix, Phase 2 acceptance stack/scripts, CI changes, migration/schema updates, backend tests, and release documentation. The complete file classification is in `WEAVIA_RELEASE_CHANGE_REVIEW.md`.

Unrelated Web/UI, marketing, screenshots, and project-note changes remain uncommitted in the local working tree and were not deployed.

## 3. Deployment version and backup

- Server: `47.113.148.107`
- Target: `/opt/weavia`
- `WEAVIA_DEPLOY_VERSION`: `01e49e9e6c4f322aa08a7edbd0210771af65dffd`
- Pre-deployment backup: `/opt/weavia-backups/weavia-20261012033519`
- Database and asset volumes were preserved; no `docker compose down -v` or data deletion was used.

## 4. Docker status

Production Compose services are running:

- `weavia-postgres-1`: healthy
- `weavia-backend-1`: healthy
- `weavia-worker-1`: running

The migration container completed with exit code 0. Docker volumes `weavia_weavia-postgres` and `weavia_weavia-assets` still exist.

## 5. Database status

PostgreSQL is healthy. API readiness reports `database: ok`. Migration completed successfully before API and Worker startup.

## 6. API status

API is healthy and `/api/health` returned `status: ok`. `/api/readiness` returned:

```json
{"checks":{"database":"ok","queue":"ok","storage":"ok"},"status":"ready"}
```

## 7. Worker status

Worker is running and logged `WEAVIA worker started queue=ai_generation real_ai_enabled=false`.

## 8. Acceptance result

**FAIL — infrastructure/network failure during acceptance image build.**

Command:

```bash
cd /opt/weavia
./scripts/local-acceptance.sh
```

Failure step: Docker build of the `integration-test`/migration image at `RUN go mod download`.

Observed log:

```text
go: github.com/go-chi/chi/v5@v5.3.2: Get "https://proxy.golang.org/github.com/go-chi/chi/v5/@v/v5.3.2.mod": dial tcp 142.251.34.209:443: i/o timeout
process "/bin/sh -c go mod download" did not complete successfully: exit code: 1
```

The acceptance script cleaned up its disposable stack. This is not a commercial-flow test failure; the integration test did not start.

## 9. Unresolved risks and recommended next action

- Phase 2 acceptance is not signed off because the server cannot currently download Go modules from `proxy.golang.org`.
- Configure server egress/DNS/proxy access to `proxy.golang.org`, or provide a pre-populated Go module/build cache or prebuilt acceptance image, then rerun the exact acceptance command.
- Real Provider calls remain disabled (`real_ai_enabled=false`); no billable Provider call was made.
- A passing acceptance run still does not replace the required paired database/asset restore test or approved real-Provider smoke test.
