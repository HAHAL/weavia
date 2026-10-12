# WEAVIA Commercial Readiness Phase 2 — Validation Report

Date: 2026-10-12 (Asia/Shanghai)

## Purpose and result

Phase 2 prepares a repeatable production acceptance path for the Phase 1 generated-asset persistence change. No business feature, Provider integration, membership behavior, price, or Credits rule was added or changed. **Production canary is not signed off:** this host has no Docker or PostgreSQL client, so the PostgreSQL/River stack and real Provider call have not been executed here. The release owner must close the gates below with recorded evidence before admitting real users.

## Phase 1 asset persistence review

The API and Worker both use the configured `ASSET_STORAGE_DIR`; the deployment must prove they mount the same volume. Generated Provider bytes are limited to 10 MiB, checked for PNG/JPEG/WebP signatures, written to a private `generated/<taskId>/<index>.<ext>` file through a temporary file, synced, renamed, and read back before the task can settle. HTTPS result fetch rejects private addresses, redirects, and proxy use. `tasks.output` and `assets.object_key` hold the owned key, and task detail reconstructs `base64Data` for Desktop. Reconciliation verifies files before recording the generated Asset and confirming Credits. Unit tests cover persistence, corruption, unavailable files, and retry/settlement behavior.

Limits: the current asset store is a shared filesystem, so production deployment is single-host or otherwise requires a truly shared durable mount. Historical completed tasks still may refer to Provider URLs/data URIs. A crash after Provider success but before the `reconciling` output is saved can repeat the Provider request with the same idempotency key; actual billing behavior depends on the Provider. No restore test or paid Provider response is proven by local unit tests.

## Changes made

| File | Change |
| --- | --- |
| `docker-compose.acceptance.yml` | Isolated disposable PostgreSQL 17, River migration, and Go integration-test services; no published ports or Provider keys. |
| `scripts/local-acceptance.sh` | One-command Compose run and cleanup with exit status preserved. |
| `services/backend/Dockerfile` | Reusable Go integration-test build target. |
| `services/backend/internal/jobs/river_integration_test.go` | Explicit test-database opt-in; removed deletion of unrelated River jobs. Existing Phase 1 assertions remain. |
| `.github/workflows/ci.yml` | Opts the isolated PostgreSQL integration job into the guarded test. |
| `scripts/provider-preflight.sh` | Read-only checks for production mode, TLS, model/provider enablement, matching server key, HTTPS endpoint, storage, and approved call/budget bounds. Makes no Provider request. |
| `docs/PHASE2_ACCEPTANCE.md`, `docs/PRODUCTION.md` | Local procedure, production checklist, real-call gate, monitoring, and rollback. |

The existing uncommitted user changes were preserved. The Phase 1 files already modified before this work remain in the working tree.

## Validation evidence

| Check | Result |
| --- | --- |
| `GOCACHE=/private/tmp/weavia-go-cache go test ./...` in `services/backend` | Pass. |
| `GOCACHE=/private/tmp/weavia-go-cache go vet ./...` in `services/backend` | Pass. |
| `go test -tags integration ./internal/jobs -run '^TestCommercialPostgresRiverE2E$' -count=1 -v` | Compiles and reports **SKIP** because `DATABASE_URL` is unset. This is not a database pass. |
| `bash -n scripts/local-acceptance.sh scripts/provider-preflight.sh` | Pass. |
| Ruby YAML parse of `docker-compose.acceptance.yml` | Pass; services are PostgreSQL, River migration, and integration test. Docker Compose semantic validation remains pending. |
| `./scripts/local-acceptance.sh` | Cannot run: `Docker is required for local acceptance`. Docker is absent on this host. |
| `./scripts/provider-preflight.sh` with production flags but no secrets | Correctly blocks on missing `DATABASE_URL`; full preflight needs the controlled production environment and approval data. |
| Preflight with a dummy TLS-disabled URL | Correctly blocks before any database or Provider connection. |
| Integration test with a dummy URL but no test-database opt-in | Correctly fails before connecting; this is an expected guard test, not an E2E failure. |
| `git diff --check` | Pass. |

The repository-wide Web/Admin/Desktop gates were not rerun because Phase 2 did not alter those runtimes; existing unrelated UI changes in the worktree need their own validation before release. The Compose stack itself remains unverified until run on a Docker host.

## Commercial flow regression and release gates

The Go suite passes the existing Credits amount, reserve, failure release, retry, and confirmation tests. The database-level integration scenario is prepared to verify registration/login, asset upload, idempotent task creation, River execution, private generated file readback, and exactly one reserve/consume. It still needs a **passing** run of `./scripts/local-acceptance.sh` and the CI PostgreSQL job on the final commit. Membership, payment, and admin permission checks must be recorded through the existing release gates; no Phase 2 change targeted them.

Before a real Provider request, require a named approver, model and region, maximum one-call smoke scope, explicit CNY budget, server-side key, account quota, monitored spend, confirmed shared asset mount, and a rollback operator. Run `scripts/provider-preflight.sh` with `ENABLE_REAL_AI=false`, then conduct only the approved bounded call. Verify the task result file from API and Worker, task response, Asset row, Credit settlement, and Provider charge. Mock output cannot substitute for this evidence. Keep real AI disabled if any check fails.

## Database impact

No table, index, migration, or data backfill was introduced by Phase 2. The acceptance Compose database is temporary and populated from checked-in SQL; CI continues to run canonical Drizzle and River migrations. The integration test no longer deletes River jobs. Production requires a paired PostgreSQL and asset-volume backup and tested restore before migration or canary. Historical completed generated assets require a separate inventory and recovery plan.

## API impact

None in Phase 2: no path, request/response field, error code, authentication rule, or client compatibility change. The Phase 1 object-key and task-detail behavior remains the subject of validation. Deploy API and Worker together because older Worker builds cannot process object-key-only outputs.

## Rollback and unresolved risks

The new Compose and preflight files can be removed without changing runtime data. For a production incident, disable new generation and real AI calls, retain database and asset volume, examine `reconciling` tasks and reservations, and use a forward fix unless the rollback Worker can read every outstanding output. Do not restore only one of database and volume. Unresolved gates are: actual PostgreSQL/River test run, staging volume restore/readback, final CI on the release commit, historical asset inventory, existing commercial-flow checks, and one separately approved real Provider call. The project is prepared for a small canary **after** these gates pass; this report does not authorize or claim production release.
