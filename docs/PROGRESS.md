# Go Backend Migration

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
