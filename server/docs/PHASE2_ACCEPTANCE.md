# Phase 2 local and canary acceptance

## Local PostgreSQL/River acceptance

Prerequisites: Docker Engine with Compose v2, enough disk for the Go image build, and no concurrent acceptance run using the `weavia-acceptance` Compose project.

```bash
./scripts/local-acceptance.sh
```

The script starts an isolated PostgreSQL 17 database with temporary storage, applies the checked-in SQL files from `packages/database/drizzle`, runs River migrations, and executes `TestCommercialPostgresRiverE2E` with a mock Provider. No ports, provider keys, or production database are used. It removes the stack on exit. A zero exit code is required. The test opts in with `WEAVIA_INTEGRATION_TEST_DB=1` and accepts only a database name ending in `_acceptance` or `_test`; never set that variable against a shared or production database. CI separately runs the canonical Drizzle migration command and the same Go test.

The E2E asserts registration/login, linked workspace/product/SKU/source asset, idempotent task submission, River completion, Credit reservation and confirmation, generated Asset row, private generated object key, and asset file readback. It does not prove a real Provider response, shared deployment mounts, backups, or restore.

If it fails, retain the console output and inspect the failed service before cleanup with `docker compose -f docker-compose.acceptance.yml logs`. Run the script again from a clean temporary database after fixing the cause; do not point it at user data.

## Production deployment checklist

Record an owner, time, command output or screenshot, and pass/fail for every item in the release ticket. Any failed item blocks canary traffic.

1. **Change and recovery:** review the exact API, Worker, Web, and Admin build hashes. Back up PostgreSQL and the shared asset volume at the same deployment point. Restore both into staging and read a sampled generated file. Keep a rollback build and know how to stop new task intake.
2. **Database:** use PostgreSQL 17, TLS, non-default credentials, least-privilege runtime accounts, and run `scripts/production-migrate.sh` from a privileged deployment session. Confirm its backup path, migration exit code, required tables, seed rows, and River migration. Do not alter published migrations in place.
3. **Runtime:** set `APP_ENV=production`, `DEMO_MODE=false`, a strong shared `STORAGE_SIGNING_KEY`, HTTPS `WEAVIA_WEB_ORIGIN`, and correct internal `WEAVIA_BACKEND_URL`. Verify `/api/health` and `/api/readiness`; readiness must be 200 with database, River, and writable storage available.
4. **Asset durability:** API and Worker mount the same persistent `ASSET_STORAGE_DIR`. Generate a mock result in staging, verify the `generated/<taskId>/...` file from both processes, read it through task detail, and restore a copied volume to confirm readback. Record disk capacity and alert threshold. Inventory legacy completed rows whose `object_key` or output still references a Provider URL/data URI; assign recovery before links expire.
5. **Commercial path:** in staging, verify registration/login, workspace/product/SKU asset upload, one idempotent River task, exactly one reserve and consume, and the expected balance. Exercise failure release and retry without duplicate settlement. Check ordinary user/admin role boundaries, admin audit records, membership, and payment flows using existing regression gates; do not change pricing or Credits rules during this phase.
6. **Provider gate:** keep `ENABLE_REAL_AI=false` until the read-only preflight below passes and an owner approves a bounded real call. Confirm the selected existing model, region, key scope, endpoint, expected cost, maximum attempts and calls, and operator contact. Stop if the Provider contract or returned image format differs from the tested path.
7. **Canary:** deploy API and Worker together; old Worker code cannot interpret new object-key-only outputs. Start with a small user cohort and explicit concurrency/budget cap outside the application. Watch task failures, stale `reconciling` tasks, River retries, provider errors, Credit reservation discrepancies, unreadable assets, readiness, and disk usage. Expand only after a reviewed observation window.

**Rollback:** disable new generation intake and real AI calls, preserve database and asset volume, inspect in-flight `reconciling` and reserved Credits, then roll API and Worker back together only after confirming the older binaries can read all outstanding task outputs. Otherwise use a forward fix. Restore the paired database and volume only under the incident procedure, since restoring one without the other can orphan assets or settlement state.

## Read-only Provider preflight

On the production host, load secrets from the secret manager into the shell without printing them. Set `PROVIDER_TEST_MODEL` to one existing registered model, `PROVIDER_TEST_APPROVAL_ID` to the reviewed approval, and `PROVIDER_TEST_MAX_CALLS` and `PROVIDER_TEST_BUDGET_CNY` to the approved bounds. Run:

```bash
APP_ENV=production DEMO_MODE=false ENABLE_REAL_AI=false ./scripts/provider-preflight.sh
```

The script requires TLS, a writable asset directory, a signing key, an enabled priced model/provider in PostgreSQL, the matching server-side key, HTTPS Provider base URL, and a positive call/budget limit. It makes **no** Provider request. Separately verify the API and Worker see the same volume and key, Provider account quota and regional endpoint, key rotation/expiry, response URL accessibility from the Worker, approval owner, spend alert, and rollback operator. Then enable real AI only for the approved one-call smoke test, verify persisted bytes and Credit settlement, and switch it off if any check fails. A mock test or a preflight pass is not approval to spend.
