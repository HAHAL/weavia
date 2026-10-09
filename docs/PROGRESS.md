# Go Backend Migration

- Done: Chi API/Worker module, pgx + sqlc task persistence, River queue/migrations, OpenAPI, Docker Compose.
- Done: additive PostgreSQL migration for future Products and Payments; existing tables/data are untouched.
- Done: auth, model catalog/quality mapping, credits estimate, prompt templates, generation task/result, assets, AntDigital and DashScope adapters, admin AI APIs.
- Done: Next API replaced by Go rewrite; Desktop polls asynchronous task results.
- Safety: real AI disabled by default; no paid acceptance call executed during migration.
- Verification limit: this host has no Docker or PostgreSQL client, so Compose startup and a live database connection still require execution on a Docker-capable host.
- Remaining: production auth persistence/authorization, persisted admin catalog/usage metrics, Credits settlement, Orders/Payments/Products APIs, object-storage replacement for the shared development volume.
