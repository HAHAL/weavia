# WEAVIA RC1 production deployment

For the Phase 2 release gate, run the [local PostgreSQL/River acceptance and production checklist](PHASE2_ACCEPTANCE.md) and record the evidence before canary traffic.

## Required runtime separation

Deploy the Go API, River worker, Web, and Admin as separate processes. Use a PostgreSQL 17 database with TLS. API and Worker must see the same durable `ASSET_STORAGE_DIR`; the current implementation is suitable only for a single host with a shared persistent volume. Do not scale either service across hosts until asset storage is moved to an object store.

Run `scripts/production-migrate.sh` before starting API and Worker. Its backup is mandatory. The script does not run on application startup and does not restore data automatically after a failed migration.

## Environment

API and Worker:

| Variable | Production setting |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL URL with TLS and non-default credentials |
| `BACKEND_ADDR` | Internal listen address, usually `:8080` |
| `WEAVIA_WEB_ORIGIN` | Public HTTPS Web origin for desktop authorization |
| `STORAGE_SIGNING_KEY` | Secret manager value; long random string shared by API and Worker |
| `ASSET_STORAGE_DIR` | Shared persistent asset directory |
| `DEMO_MODE` | `false`; `true` is accepted only with `APP_ENV=test` |
| `ENABLE_REAL_AI` | `false` until paid provider acceptance, then `true` |
| `ANTDIGITAL_API_KEY` / `DASHSCOPE_API_KEY` | Server-side keys for enabled providers |
| `ANTDIGITAL_BASE_URL` / `DASHSCOPE_BASE_URL` | Provider endpoints for the selected region |
| `AI_PROVIDER_TIMEOUT_MS` | Provider request timeout; default 120000 |

Web: set `WEAVIA_BACKEND_URL` to the internal API origin at build and runtime. Desktop: build with production `VITE_API_BASE_URL` (embedded in the bundle). Admin: set `WEAVIA_BACKEND_URL` to the internal API origin. Never put provider keys in `NEXT_PUBLIC_*` or `VITE_*` variables.

`AUTH_SECRET`, `ANTDIGITAL_IMAGE_MODEL`, `AI_MAX_CONCURRENT_TASKS_PER_USER`, and `AI_MAX_PROVIDER_ATTEMPTS` are not used by the current Go runtime and should not be treated as active controls.

## Database migration

1. Provision the production database, a backup directory, and tools `pg_dump`, `psql`, `pnpm`, and `go`.
2. Export `DATABASE_URL` and `BACKUP_DIR`.
3. Run `scripts/production-migrate.sh`; retain the printed backup path.
4. Verify `/api/readiness` returns 200 after API and Worker start.
5. Grant the first administrator role out of band after registering the intended user:

```sql
INSERT INTO user_roles(user_id,role_id)
SELECT u.id,r.id FROM users u CROSS JOIN roles r
WHERE u.email = '<approved-admin-email>' AND r.code = 'super_admin'
ON CONFLICT DO NOTHING;
```

Use a reviewed email and execute the SQL through a privileged deployment session. Public registration never assigns admin roles. Operator and Finance roles can be granted through the same reviewed process.

## Release checks

- `/api/health` is a liveness endpoint. `/api/readiness` checks PostgreSQL, River queue table, and writable asset storage. It returns 503 if any dependency fails.
- Confirm anonymous `/api/admin/*` requests return 401, ordinary user requests return 403, and role holders receive only assigned permissions. Admin audit IP is the direct peer address; configure the trusted reverse proxy to preserve source address at the network layer if operators need client IPs in the audit log.
- Confirm Web to Desktop authorization rejects anonymous requests and that `DEMO_MODE` is disabled.
- Confirm provider keys and model registry rows exist, and the selected provider is enabled in `ai_providers`.
- Run the paid-provider smoke test with an approved small budget before changing `ENABLE_REAL_AI` to `true`.
- Monitor task status, credit reservations, failed River jobs, disk capacity, API readiness, and provider failures during canary rollout.
- Back up and restore-test the shared `ASSET_STORAGE_DIR` alongside PostgreSQL. API and Worker must mount the same durable volume. New generated outputs are copied there before Credits confirmation; a missing or unreadable output leaves its task in `reconciling` for investigation and retry. Check for stranded `reconciling` tasks and reservation balances before and after rollout.
- Historical completed tasks may still contain expired Provider URLs or data URIs. Inventory `assets.object_key` and `tasks.output` for values outside `generated/` and recover accessible files into the shared volume before retiring old storage; expired links require regeneration or a user-facing recovery process.
