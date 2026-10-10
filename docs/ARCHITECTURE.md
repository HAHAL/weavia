# WEAVIA V1.0 Architecture

## Runtime

```text
Next.js Web/Admin ─┐
                   ├─ HTTP/OpenAPI ─> Go API (Chi) ─> PostgreSQL (pgx/sqlc)
Tauri Desktop ─────┘                         │
                                             └─ River ─> Go Worker ─> Provider adapters
```

- `services/backend/cmd/api` serves auth, model catalog, estimates, templates, assets, generation tasks/results, and admin AI APIs.
- `services/backend/cmd/worker` consumes the `ai_generation` River queue. API and Worker share the existing PostgreSQL task tables and temporary asset volume.
- `packages/database/drizzle` remains the canonical application migration history. Go uses generated sqlc access code and River owns only its queue tables.
- Web and Admin retain rendering duties. Web `/api/*` is a compatibility rewrite to the Go API; no Next.js business Route Handlers remain.
- Desktop keeps local SQLite/project storage and calls the same cloud contract through `@weavia/api-client`.

## Generation safety

- Real provider calls require both `ENABLE_REAL_AI=true` and a server-side provider key; Compose and tests default to false.
- `user_id + idempotency_key` is unique in PostgreSQL.
- River retries job orchestration, but a task in `running`, `failed`, `generated`, or `cancelled` is never automatically resent to an external provider. The provider also receives the stable idempotency key.
- Provider request IDs and outputs are persisted with the task result. Ambiguous network failures require reconciliation/manual retry, not automatic paid-request replay.

## Data ownership

PostgreSQL remains the single cloud business data source for Users, Memberships, Credits, Orders, Tasks, Models, Providers, Products (extensible), Payments (extensible), and Assets. Desktop SQLite remains the local-first source for local projects and downloaded results; it is not a second cloud business backend.
