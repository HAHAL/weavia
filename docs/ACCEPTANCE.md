# Go Backend Final Integration Acceptance

Date: 2026-10-10

## Commercial V1 Phase 1 acceptance

The implementation now supports the commercial chain:

1. Register or log in on Web and persist the account/session/device in PostgreSQL.
2. Create a workspace, project, product, SKU, and SKU asset.
3. Submit a generation task carrying workspace/product/SKU identity.
4. Reserve Credits in an idempotent PostgreSQL transaction before River enqueue.
5. Execute through the existing River worker and AI gateway.
6. Confirm the reservation and append consumption on success, or release it on failure.
7. Persist provider, model, cost, task result, ledger history, and audit history.
8. Query users, memberships, balances, transactions, tasks, and model usage from Admin APIs.

Local checks passed: `go test ./...`, `go vet ./...`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `cargo test` (15 tests), and `cargo check`.

PostgreSQL execution is pending CI because this workstation has neither Docker nor a PostgreSQL client. The migration is additive and retains the legacy membership/wallet tables for compatibility while introducing the Commercial V1 subscription and append-only ledger tables.

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

GitHub Actions run `38054011415` completed successfully for commit `9599ea2`.

## Pending

- `PENDING_REAL_PROVIDER_TEST`: qwen-image-2.0 requires explicit authorization for call count and fee budget before execution.
