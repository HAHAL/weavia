import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Commercial V1 migration', () => {
  const sql = readFileSync(resolve(process.cwd(), 'drizzle/0005_commercial_v1.sql'), 'utf8');

  it('defines every persistent commercial aggregate and seed plan', () => {
    for (const table of [
      'auth_requests', 'auth_codes', 'subscriptions', 'entitlements',
      'credit_accounts', 'credit_reservations', 'credit_transactions_v1', 'audit_logs',
      'workspaces', 'workspace_members', 'projects', 'skus',
    ]) expect(sql).toContain(`CREATE TABLE "${table}"`);
    for (const plan of ['free', 'pro', 'studio', 'agency']) expect(sql).toContain(`'${plan}'`);
  });

  it('adds task commercial ownership, routing, and cost columns', () => {
    for (const column of ['workspace_id', 'product_id', 'sku_id', 'credit_reservation_id', 'provider', 'model', 'cost']) {
      expect(sql).toContain(`ALTER TABLE "tasks" ADD COLUMN "${column}"`);
    }
  });

  it('enforces append-only ledger idempotency and non-negative balances', () => {
    expect(sql).toContain('"idempotency_key" text NOT NULL UNIQUE');
    expect(sql).toContain('CHECK ("available_balance" >= 0)');
    expect(sql).toContain('CHECK ("reserved_balance" >= 0)');
  });
});
