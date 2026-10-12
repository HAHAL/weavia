# WEAVIA Commercial Readiness Phase 1 — Change Report

## Purpose and current chain

The River Worker calls the selected existing Provider, saves its returned URL or data URI in `tasks.output`, then `RecordGeneratedAsset` previously copied that same source into `assets.object_key` and `assets.metadata.source`. Credits were confirmed after this database write, although no WEAVIA-owned file had been downloaded or read back. Desktop consumed `temporaryUrl` or `base64Data` from `GET /api/ai/tasks/{taskId}` and saved a local copy.

## Changed behavior and files

- `services/backend/internal/assets/generated.go`, `storage_test.go`: limit generated images to 10 MiB, accept PNG/JPEG/WebP signatures, fetch HTTPS results with public-address validation and no redirects or proxies, or decode base64 data URIs. Write a private `generated/{taskId}/{index}.{ext}` file atomically, sync it, and verify readback. Reject invalid paths and corrupted files.
- `services/backend/internal/generation/service.go`, `service_test.go`: persist outputs before storing `reconciling`; task output now contains object key, MIME and size. On retry, verify files before recording assets and confirming Credits. Reconcile legacy in-flight Provider URLs/data URIs into owned storage. A missing file blocks settlement without another Provider call. Successful task detail reads reconstruct `base64Data` from the owned file for Desktop compatibility.
- `services/backend/internal/commercial/service.go`: generated Asset rows store the owned object key and actual size, with no Provider source in metadata. Existing in-flight generated rows are updated during reconciliation. Credits confirmation checks for an uploaded, nonempty generated Asset row belonging to the task and user.
- `services/backend/cmd/{api,worker}/main.go`, `services/backend/internal/httpapi/server.go`, `packages/shared/src/index.ts`, `services/backend/openapi.yaml`: connect both processes to the same generated storage and describe the additive output fields. Task list responses carry object keys; task detail responses hydrate the image bytes.
- `services/backend/internal/jobs/river_integration_test.go`, `docs/PRODUCTION.md`: extend the fake Provider acceptance path to assert a private readable file and no Provider source in Asset metadata; document volume backup and historical recovery.

No commercial architecture, Provider routing, membership logic, price, or Credits amounts changed. Web and Admin code were not changed for this phase. Existing unrelated uncommitted changes were preserved.

## Failure and recovery path

Provider/download/storage failure returns an error to River without confirming Credits. If the task has persisted `reconciling` outputs, retry verifies the same file and does not call the Provider again. Asset insert and Credits settlement are idempotent; a failure after Credits confirmation but before task success can retry completion. A process crash after Provider success but before `reconciling` is recorded may call the Provider again with the same idempotency key; this remains dependent on the Provider honoring that key. Do not treat an ambiguous Provider result as proof of a second charge.

Rollback: stop new task intake, retain the shared asset volume and database backup, and drain or inspect `reconciling` tasks. Roll back API and Worker together because old Worker code cannot interpret new object-key-only outputs. Preserve the new files and rows for a forward fix; do not delete the volume. On deployment, back up PostgreSQL and the asset volume, verify shared mounts, then smoke-test one fake and one approved-budget real generation and readback before wider traffic.

## Database impact

No table, index, migration, or schema change. `assets.object_key` now holds `generated/...` and `assets.size` the actual byte length; `assets.metadata` no longer stores a Provider source. `tasks.output` stores owned object keys rather than Provider URLs or data URIs. No automatic backfill of historical *completed* rows: inventory these rows and copy still-accessible files before their Provider links expire. Data must be retained with a volume backup and restore test. A new migration is unnecessary; the existing schema supports the new keys.

## API impact

`GET /api/ai/tasks/{taskId}` keeps its path, Bearer authentication, success envelope, and error shape. Successful new outputs add `objectKey` and `size` and retain `base64Data` reconstructed from private storage; `temporaryUrl` is absent. Missing/corrupt files return the existing generic 500 error. `GET /api/ai/tasks` returns the stored object key without embedding large image data. No new path, request field, or error code. Desktop remains compatible through `base64Data`. Legacy completed rows still return their stored source. No version change is required for these additive fields; old API/Worker binaries must not be deployed against new object-key-only tasks.

## Verification and commercial regression

- Passed: `GOCACHE=/private/tmp/weavia-go-cache go test ./...`, `go vet ./...` in `services/backend`.
- Passed: direct `tsc --noEmit` for shared and api-client, `tsc -b` for Desktop; direct Vitest for shared (1 test), api-client (no tests), Desktop (16 tests); direct ESLint for shared; `git diff --check`.
- Unit coverage includes valid persistence/readback, corruption, private result URL rejection, task/credit idempotency, failed Provider release, confirmation retry and missing file blocking confirmation. The commercial PostgreSQL/River test now checks readable own storage and metadata but **was skipped** because `DATABASE_URL` is unavailable. No PostgreSQL or River acceptance result is claimed.
- Repository `pnpm typecheck/test` and Turbo `typecheck/test/lint` failed before package tasks because the local pnpm wrapper attempted an unavailable npm registry fetch and module purge. Direct affected-package commands above passed; full monorepo lint/typecheck/test/build remains unverified.
- Registration, login, membership, admin permissions and payment were not changed or rerun. Credits amount, reserve, repeat confirmation, failure release, and retry behavior passed Go unit tests; database-level balance, concurrent reservation and recovery require the PostgreSQL/River run. No real Provider or paid test was performed.

## Open risks and release gate

Production release still requires PostgreSQL/River integration, staging restore test, shared-volume mount/readback test, and a small real Provider call within an approved budget. Historical completed assets with expired Provider URLs cannot be repaired automatically. The current private-volume topology remains single-host/shared-volume only; cross-host scaling requires a future object-store change. Image data is still returned as a base64 data URI on task detail for current Desktop compatibility, which can increase response size. Monitor disk capacity, unreadable assets, `reconciling` age, and Credits reservation discrepancies. This report is not production sign-off.
