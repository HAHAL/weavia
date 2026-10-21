import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const sql=readFileSync(resolve(process.cwd(),'drizzle/0007_account_foundation.sql'),'utf8');
describe('Sprint 3.1 migration safety',()=>{
 it('creates account foundations with rerun guards',()=>{
  for(const table of ['registration_requests','email_verifications','login_events','user_deletion_requests','data_deletion_jobs'])expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  expect(sql).toContain('ADD COLUMN IF NOT EXISTS email_verified_at');
  expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique');
 });
 it('stores verification hashes and enforces one-time and rate metadata',()=>{
  for(const column of ['code_hash','token_hash','expires_at','used_at','next_send_at','attempt_count'])expect(sql).toContain(column);
  expect(sql).toContain('registration_requests_pending_email_unique');
 });
 it('prevents physical deletion and keeps commercial FKs unchanged',()=>{
  expect(sql).toContain('BEFORE DELETE ON users');
  expect(sql).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM|ON DELETE CASCADE/i);
  expect(sql).toContain('approved_by uuid NOT NULL');
  expect(sql).toContain('BEFORE INSERT OR UPDATE ON data_deletion_jobs');
 });
});

it.skipIf(!process.env.DATABASE_URL || process.env.WEAVIA_INTEGRATION_TEST_DB !== '1')('replays migration twice without changing existing rows', async () => {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const database = await client.query<{ current_database: string }>('SELECT current_database()');
    expect(database.rows[0]?.current_database).toMatch(/_(test|acceptance)$/);
    const before = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    for (let i = 0; i < 2; i++) {
      for (const statement of sql.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) await client.query(statement);
    }
    const after = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  } finally { await client.end(); }
});
