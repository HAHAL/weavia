# WEAVIA V1.0 production readiness — RC1 code handoff

Date: 2026-10-11. Branch: `phase/production-readiness-final`.

## Completed in this sprint

- Admin APIs require a valid session and a role permission. Super Admin, Operator, and Finance roles and permission assignments are seeded; provider, Credits, user-status, and plan mutations write transactional audit records with actor, action, resource, time, and peer IP. Admin UI now has sign-in and an HttpOnly-cookie server proxy.
- Anonymous desktop authorization no longer enters a Demo User. `DEMO_MODE=true` is permitted only with `APP_ENV=test`; production requests without a valid user receive 401.
- Model/provider/cost/capability resolution for task creation and price estimation reads `ai_models` and `ai_providers`. The router selects by registered provider; disabled providers/models are rejected. The existing `ai_models` table is extended rather than replaced.
- Task persistence, Credits reservations, queue delivery, provider call, generated asset, and Credits confirmation have regression coverage for success, failure, duplicate requests, and retry/reconciliation. Failure releases reservations; duplicate asset insertion is serialized.
- Backup-first production migration script, schema/seed verification, liveness/readiness split, storage signature expiry, production configuration validation, separate API/Worker Compose services, and CI migration assertions are present.
- The pre-existing registration ledger SQL parameter fix was preserved and verified with the Go suite.

## Verification performed

| Check | Result |
| --- | --- |
| `go test ./...` | Pass |
| `go vet ./...` | Pass |
| Integration-tag test compile | Pass; live PostgreSQL test not run locally |
| TypeScript tests | 25 tests pass (22 workspace tests plus 3 database tests); database test must run from its package directory |
| TypeScript typecheck | Database and Admin pass |
| Admin production build | Pass |
| ESLint on changed TypeScript | Pass |
| Rust `cargo check` | Pass |
| Migration script syntax and `git diff --check` | Pass |

The generic `pnpm` launcher on this workstation attempts to fetch a different package-manager version and to reinstall dependencies despite the repository pin. Direct local executables were used for the final TypeScript checks. CI uses `pnpm/action-setup` and remains the canonical full-workspace build gate.

## Remaining release gates and risks

1. **Production database migration not yet executed.** No PostgreSQL/Docker/`pg_dump` was available locally. Run the backup-first script against a staging copy of the existing database, validate row counts and a restore drill, then run in production maintenance window. A migration or seed conflict must block release.
2. **Real paid-provider acceptance not yet executed.** No approved keys or spending budget were supplied. With `ENABLE_REAL_AI=false`, generation is intentionally unavailable. A limited-budget real request must verify both configured provider routes, asset persistence, Credits settlement, and failure/refund behavior before enabling traffic.
3. **Deployment infrastructure requires validation.** Shared local asset storage is single-host only; the API and Worker must mount the same persistent volume and cannot safely scale across hosts. Test restart and disk-pressure behavior. Configure TLS, secrets, backups, monitoring, and alerting in the target environment.
4. **Provider-side idempotency is not guaranteed by local tests.** A crash between provider success and local reconciliation can repeat an external call; the same task idempotency key is sent on retry, but the provider contract must be checked in live acceptance.
5. **Presentation/operations debt remains.** Several Admin and Web pages are placeholders; Admin catalog/usage display still contains static or empty views, although authorization, provider enablement, task routing, and billing use persisted state. No payments or subscription checkout acceptance has been demonstrated here. These must not be marketed as complete self-serve commerce.
6. **Version metadata remains `0.1.0`.** Align release tags and package versions before public V1.0 labeling; no runtime behavior depends on the label.

Code changes are an RC1 candidate, **not approval for unrestricted production launch** until gates 1–3 pass.

## Deployment sequence

1. Provision PostgreSQL 17 with TLS, shared persistent asset storage, separate API and Worker processes, Web and Admin hosts, and secret-manager values from `docs/PRODUCTION.md`.
2. Deploy the same tested commit to staging. Set `APP_ENV=production`, `DEMO_MODE=false`, and initially `ENABLE_REAL_AI=false`.
3. Export `DATABASE_URL` and `BACKUP_DIR`; run `scripts/production-migrate.sh`. Retain the backup, verify the schema/seed checks, and test restore using a separate staging database.
4. Start API and Worker separately; confirm `/api/health` and `/api/readiness`, queue consumption, login, role denial/allow rules, and Admin audit writes. Grant the initial Super Admin only through the reviewed out-of-band SQL documented in `docs/PRODUCTION.md`.
5. Test a small paid-provider job, including insufficient balance, duplicate request, failure/refund, and worker restart. Only then set `ENABLE_REAL_AI=true` and repeat readiness/smoke checks.
6. Canary to internal users, then a small customer cohort. Monitor 401/403, 5xx, River failures, provider error/latency, reservation age, balance reconciliation, storage capacity, and Admin audit events. Stop rollout and disable AI on abnormal settlement or provider behavior.

## Required environment variables

`APP_ENV=production`, `DATABASE_URL`, `STORAGE_SIGNING_KEY`, `ASSET_STORAGE_DIR`, `WEAVIA_WEB_ORIGIN` (HTTPS), `WEAVIA_BACKEND_URL` for Web/Admin, and a production `VITE_API_BASE_URL` for Desktop. Set `DEMO_MODE=false`; set `ENABLE_REAL_AI=false` until provider acceptance, then supply the appropriate `ANTDIGITAL_API_KEY` and/or `DASHSCOPE_API_KEY`. `BACKUP_DIR` is required for migration only. Optional provider base URLs and timeout are documented in `docs/PRODUCTION.md`. Never expose database or provider secrets through browser-prefixed variables.

## Database migration procedure

The script `scripts/production-migrate.sh` verifies prerequisites, creates a custom-format `pg_dump` backup, runs Drizzle application migrations, runs River migrations, then checks required tables and seeds. It supports an existing database by using journaled migrations and additive schema changes. The script never restores automatically; use the retained dump and an operator-approved recovery plan if post-migration verification fails.
