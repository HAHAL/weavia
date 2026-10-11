# WEAVIA Release Change Review

## Scope

- Baseline: `78e88edff7904cac60d0f23143bb21147dd720ba`
- Release objective: Phase 2 Acceptance deployment
- Review date: 2026-10-12 (Asia/Shanghai)
- Protected areas: commercial architecture, membership logic, Credits rules, user data, and unrelated uncommitted work

## Classification

### A. Phase 1 asset persistence

Included in the release set:

- `services/backend/internal/assets/generated.go`
- `services/backend/internal/assets/storage_test.go`
- `services/backend/internal/generation/service.go`
- `services/backend/internal/generation/service_test.go`
- `services/backend/internal/commercial/service.go`
- `services/backend/internal/httpapi/server.go`
- `services/backend/cmd/api/main.go`
- `services/backend/cmd/worker/main.go`
- `services/backend/internal/auth/admin.go`
- `packages/database/drizzle/0006_production_readiness.sql`
- `packages/database/src/schema.ts`
- `packages/shared/src/index.ts`
- `services/backend/openapi.yaml`

These changes persist generated provider bytes under private `generated/<taskId>/...` keys, verify readback before settlement, and keep API/Worker on the configured asset storage path. They also add the `reserved` task status migration required by the existing commercial flow.

### B. Phase 2 acceptance flow

Included in the release set:

- `docker-compose.acceptance.yml`
- `scripts/local-acceptance.sh`
- `scripts/provider-preflight.sh`
- `services/backend/Dockerfile`
- `services/backend/internal/jobs/river_integration_test.go`
- `.github/workflows/ci.yml`
- `docs/PHASE2_ACCEPTANCE.md`
- `docs/PRODUCTION.md`

The acceptance stack is disposable and isolated. It exercises PostgreSQL 17, River migration, the guarded integration test, generated-asset readback, and commercial settlement. It does not claim a real Provider call or a production restore test.

### C. Bug fixes

Included:

- `services/backend/internal/auth/service.go`: registration audit SQL now explicitly types UUID/text parameters; audit insertion errors are checked, so registration cannot commit after a failed audit write. This is the confirmed registration Bug fix.
- `packages/database/drizzle/0006_production_readiness.sql`: existing disabled model rows retain their `enabled` state during seed upsert.
- `services/backend/internal/commercial/service.go`: audit SQL parameter types are explicit; generated assets must be durable before Credits confirmation.
- `services/backend/internal/jobs/river_integration_test.go`: integration tests no longer delete unrelated River jobs.

### D. CI/CD

Included:

- `.github/workflows/ci.yml`
- `services/backend/Dockerfile`
- `docker-compose.acceptance.yml`
- `scripts/local-acceptance.sh`
- `scripts/provider-preflight.sh`

These changes add the guarded acceptance database configuration and reusable integration-test image path. No deployment automation or secret handling was broadened.

### E. Documentation

Included:

- `docs/PHASE2_ACCEPTANCE.md`
- `docs/PRODUCTION.md`
- This review and the deployment report generated after deployment

The other pre-existing reports were reviewed as evidence but are not required release inputs.

### F. Unrelated modifications excluded from the release commit

The following were not staged because they are Web/Admin/marketing visual work or unrelated project notes, not required for Phase 2 acceptance deployment:

- `apps/web/**` UI, marketing, auth-shell, workspace, and image changes
- `packages/ui/**` visual foundation/components/styles changes
- `DEVELOPMENT_WORKFLOW.md`
- `PROJECT_ENGINEERING_AUDIT.md`
- `RC1_ACCEPTANCE_REPORT.md`
- `SERVER_ENV_CHECK.md`
- `WEAVIA_COMMERCIAL_READINESS_PHASE1_REPORT.md`
- `WEAVIA_PHASE2_VALIDATION_REPORT.md`
- `WEAVIA_SKILL_RECOMMENDATIONS.md`
- `docs/screenshots/**`

No files were deleted or overwritten. Excluded changes remain in the working tree.

## Database impact

Migration `0006_production_readiness.sql` adds the existing `reserved` enum value and preserves disabled model state during seed upsert. No user data is deleted or backfilled. Deployment must back up PostgreSQL and the shared asset volume before migration; rollback is forward-fix or paired database/asset restore under the release procedure.

## API impact

No new public path or client contract is introduced by Phase 2. API and Worker must deploy together because the object-key-only generated output behavior is shared by both.

## Verification and release gates

Run the backend tests/vet and `./scripts/local-acceptance.sh` on the final commit. If Docker or database checks fail, record the exact failing step and logs in `WEAVIA_RELEASE_DEPLOYMENT_REPORT.md`; a skipped or unavailable check is not a pass. Real Provider calls remain disabled unless separately approved.

## Recovery

Keep the pre-deployment server backup and `WEAVIA_DEPLOY_VERSION`. To roll back, stop intake, preserve PostgreSQL and asset storage, inspect reserved/reconciling tasks, and restore API/Worker together only after compatibility is confirmed.
