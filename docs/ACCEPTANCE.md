# Go Backend Final Integration Acceptance

Date: 2026-10-10

## Accepted locally

- Git branch and commit were verified before changes; the development branch was safely pushed with Git HTTP/1.1.
- `go test ./...` and `go vet ./...` pass.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.
- `cargo test` (15 tests) and `cargo check` pass.
- Web rewrites `/api/*` to `WEAVIA_BACKEND_URL` (default `http://localhost:8080`) and its compatibility tests pass.
- Desktop submission, polling, durable local result recovery, and restart tests pass.
- `ENABLE_REAL_AI` remains disabled by default. No paid model request was made.

## PostgreSQL CI acceptance

The `postgres-integration` GitHub Actions job uses an isolated PostgreSQL 17 service and:

1. Applies the canonical Drizzle application migrations to a fresh database.
2. Applies River's migrations with the Go migration command.
3. Verifies Products, Payments, and River tables.
4. Inserts a sentinel Product, reruns migrations, and verifies the row is preserved.
5. Calls the actual Go HTTP handlers for auth, asset upload, task submission, and result polling.
6. Uses the PostgreSQL task repository and River worker with a Mock AI Provider.
7. Verifies unique enqueue/idempotency, transient failure retry, queued-task recovery after no worker was running, status updates, and persisted output via a fresh repository instance.

The workflow always sets `ENABLE_REAL_AI=false`; it cannot spend provider credits.

## Pending

- `PENDING_REAL_PROVIDER_TEST`: qwen-image-2.0 requires explicit authorization for call count and fee budget before execution.
- The GitHub-hosted PostgreSQL integration job must be green for this commit before M1 entry is approved.
