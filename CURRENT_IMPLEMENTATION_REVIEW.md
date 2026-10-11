# WEAVIA V1.0 current implementation review

Date: 2026-10-11. Baseline: `phase/commercial-v1` (`c8b33b2`).

## Current state

- Go API and River worker run separately against PostgreSQL. Auth, subscriptions, Credits reservations and settlement, workspace/product/SKU/asset records, and asynchronous generation are implemented.
- Web provides registration, login, Credits, and workspace entry. Account and pricing pages and most Admin pages remain placeholders. Desktop persists local projects in SQLite, stores credentials in the OS keychain, and submits cloud generation jobs.
- Drizzle migrations `0000` through `0005` are journaled; River owns its queue migration. CI has a PostgreSQL integration job, but this checkout has no confirmed production migration result.
- Docker Compose is a development stack with fixed database credentials, a shared asset volume, and River-only migration command. AI calls default to disabled.

## RC1 modification plan

1. Add role and permission tables, admin audit log, authenticated and permission-gated Admin APIs, plus regression tests.
2. Gate demo authorization behind `DEMO_MODE`, with production returning 401 for anonymous authorization.
3. Add a persistent model registry and route providers and Credits costs through it; verify successful, failed, and repeated jobs.
4. Add a backup-first production migration script, schema/seed checks, readiness checks, and production configuration validation.
5. Update deployment documentation, run Go/TypeScript/Rust checks, and record residual release risks.

## Risks and boundaries

- Existing uncommitted change in `services/backend/internal/auth/service.go` fixes the registration Credits insert argument count. Preserve it and include it in the final verification.
- Existing production data must remain intact. Migration is additive. Backups and migrations require a real database and credentials, which cannot be proven from source inspection alone.
- Real paid-provider requests require live keys and a fee budget. Automated tests use a mock provider and cannot prove paid-provider behavior.
- Local shared-file storage is a single-host deployment constraint until replaced with durable multi-host storage.
