# Go Backend Migration

## Commercial V1 Phase 1 (2026-10-10)

- Done: PostgreSQL-persistent registration, password login, access/refresh token rotation, logout, desktop authorization, and device revocation. Production Auth has no in-memory session store.
- Done: database-configured Free, Pro, Studio, and Agency plans; subscriptions, normalized entitlements, status lookup, and expiry reconciliation.
- Done: append-only Credits commercial ledger with accounts, reservations, transactions, reserve/confirm/release, top-up/admin adjustment primitives, row locking, idempotency, and audit logs. Balances are only changed inside ledger transactions.
- Done: Workspace → Project → Product → SKU → Asset persistence and APIs, including generated asset/task association columns.
- Done: generation tasks persist workspace/product/SKU/reservation/provider/model/cost and use `reserved → running → success|failed`; River remains the worker.
- Done: admin APIs expose users/membership summary, Credits balances/transactions, commercial tasks, and the existing model usage surfaces.
- Done: Web registration/login, desktop browser authorization, Credits ledger view, and workspace entry; Desktop understands commercial task states.
- Done: OpenAPI and shared TypeScript contracts updated.
- Verified: Go tests/vet, pnpm tests/typecheck/lint/build, and Rust tests/check pass locally.
- Environment limitation: an executable PostgreSQL migration run could not be performed locally because Docker/PostgreSQL clients are not installed; the additive migration is ready for the existing PostgreSQL CI job.

- Done: Chi API/Worker module, pgx + sqlc task persistence, River queue/migrations, OpenAPI, Docker Compose.
- Done: additive PostgreSQL migration for future Products and Payments; existing tables/data are untouched.
- Done: auth, model catalog/quality mapping, credits estimate, prompt templates, generation task/result, assets, AntDigital and DashScope adapters, admin AI APIs.
- Done: Next API replaced by Go rewrite; Desktop polls asynchronous task results.
- Done: GitHub branch `refactor/go-backend-migration` pushed without force using Git HTTP/1.1.
- Done: CI now provisions an isolated PostgreSQL 17 service, runs application and River migrations, verifies Products/Payments/data preservation, then exercises the real Go HTTP API through PostgreSQL and River with a Mock AI Provider.
- Done: River jobs are unique by task arguments and transient/worker-restart states can resume with the provider idempotency key; persisted results are verified through a fresh repository instance.
- Done: local Go, TypeScript and Rust test/vet/typecheck/lint/build suites pass.
- Safety: real AI disabled by default; no paid acceptance call executed during migration.
- Verified: GitHub Actions run `38054011415` is green for quality, Go/Rust, and isolated PostgreSQL integration jobs.
- Pending: qwen-image-2.0 paid-provider acceptance (`PENDING_REAL_PROVIDER_TEST`).
- Remaining: production auth persistence/authorization, persisted admin catalog/usage metrics, Credits settlement, Orders/Payments/Products APIs, object-storage replacement for the shared development volume.
