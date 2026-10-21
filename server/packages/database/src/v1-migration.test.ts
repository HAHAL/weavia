import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('V1 migration', () => {
  const sql = readFileSync(resolve(process.cwd(), 'drizzle/0008_v1_conversations_quotes_cloud.sql'), 'utf8');

  it('creates conversation, quote, invitation and cloud tables', () => {
    for (const table of [
      'conversations', 'messages', 'quotes', 'invitations', 'invitation_redemptions',
      'storage_packs', 'storage_entitlements', 'cloud_works', 'cloud_work_versions', 'cloud_storage_usage',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('extends tasks with conversation, quote and edit fields', () => {
    for (const column of [
      'conversation_id', 'message_id', 'quote_id', 'parent_task_id', 'mode',
      'edit_mode', 'mask_asset_id', 'output_plan', 'provider_endpoint',
      'provider_task_id', 'cancel_requested_at', 'output_expires_at',
    ]) {
      expect(sql).toContain(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it('enforces quote and free-credit uniqueness', () => {
    expect(sql).toContain('idempotency_key text NOT NULL UNIQUE');
    expect(sql).toContain('credit_transactions_v1_free_grant_unique');
    expect(sql).toContain("WHERE reference_type = 'free_plan'");
  });
});
