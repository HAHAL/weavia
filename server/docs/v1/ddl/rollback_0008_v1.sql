-- Rollback draft for 0008_v1_server.sql
-- Review before use. Destructive; take a backup first.
DROP INDEX IF EXISTS credit_transactions_v1_free_grant_unique;
DROP TABLE IF EXISTS cloud_storage_usage;
DROP TABLE IF EXISTS cloud_work_versions;
DROP TABLE IF EXISTS cloud_works;
DROP TABLE IF EXISTS storage_entitlements;
DROP TABLE IF EXISTS storage_packs;
DROP TABLE IF EXISTS invitation_redemptions;
DROP TABLE IF EXISTS invitations;
DROP INDEX IF EXISTS tasks_output_expires_idx;
DROP INDEX IF EXISTS tasks_parent_idx;
DROP INDEX IF EXISTS tasks_message_idx;
DROP INDEX IF EXISTS tasks_conversation_created_idx;
ALTER TABLE tasks DROP COLUMN IF EXISTS output_expires_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS cancel_requested_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS provider_task_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS provider_endpoint;
ALTER TABLE tasks DROP COLUMN IF EXISTS output_plan;
ALTER TABLE tasks DROP COLUMN IF EXISTS mask_asset_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS edit_mode;
ALTER TABLE tasks DROP COLUMN IF EXISTS mode;
ALTER TABLE tasks DROP COLUMN IF EXISTS parent_task_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS quote_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS message_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS conversation_id;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
