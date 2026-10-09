import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const membershipStatus = pgEnum('membership_status', [
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired',
]);
export const transactionType = pgEnum('credits_transaction_type', [
  'grant',
  'freeze',
  'consume',
  'unfreeze',
  'expire',
  'adjust',
]);
export const taskStatus = pgEnum('task_status', [
  'pending',
  'queued',
  'uploading',
  'running',
  'downloading',
  'reconciling',
  'success',
  'failed',
  'cancelled',
]);
export const taskType = pgEnum('task_type', [
  'ai_model',
  'ai_commercial',
  'product_image_generation',
  'image_generation',
  'image_edit',
  'image_to_video',
]);
export const orderStatus = pgEnum('order_status', [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
]);
export const assetRole = pgEnum('asset_role', ['INPUT', 'REFERENCE_IMAGE', 'GENERATED_RESULT']);
export const assetUploadStatus = pgEnum('asset_upload_status', [
  'LOCAL',
  'PENDING',
  'UPLOADED',
  'FAILED',
  'EXPIRED',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    status: text('status').default('active').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('accounts_provider_unique').on(t.provider, t.providerAccountId)],
);
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('sessions_token_hash_unique').on(t.tokenHash)],
);
export const plans = pgTable(
  'plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    billingCycle: text('billing_cycle').notNull(),
    priceMinor: integer('price_minor').default(0).notNull(),
    includedCredits: bigint('included_credits', { mode: 'number' }).default(0).notNull(),
    maxDevices: integer('max_devices').default(1).notNull(),
    maxConcurrency: integer('max_concurrency').default(1).notNull(),
    entitlements: jsonb('entitlements')
      .$type<Record<string, boolean | number | string>>()
      .default({})
      .notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('plans_code_unique').on(t.code)],
);
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    planId: uuid('plan_id')
      .references(() => plans.id)
      .notNull(),
    status: membershipStatus('status').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    entitlementSnapshot: jsonb('entitlement_snapshot').default({}).notNull(),
    ...timestamps,
  },
  (t) => [index('memberships_user_idx').on(t.userId)],
);
export const creditsWallets = pgTable(
  'credits_wallets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    availableBalance: bigint('available_balance', { mode: 'number' }).default(0).notNull(),
    frozenBalance: bigint('frozen_balance', { mode: 'number' }).default(0).notNull(),
    lifetimeConsumed: bigint('lifetime_consumed', { mode: 'number' }).default(0).notNull(),
    version: integer('version').default(0).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('credits_wallets_user_unique').on(t.userId)],
);
export const creditsTransactions = pgTable(
  'credits_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    walletId: uuid('wallet_id')
      .references(() => creditsWallets.id, { onDelete: 'cascade' })
      .notNull(),
    type: transactionType('type').notNull(),
    availableDelta: bigint('available_delta', { mode: 'number' }).notNull(),
    frozenDelta: bigint('frozen_delta', { mode: 'number' }).notNull(),
    referenceType: text('reference_type').notNull(),
    referenceId: text('reference_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('credits_transactions_idempotency_unique').on(t.idempotencyKey),
    index('credits_transactions_wallet_idx').on(t.walletId),
  ],
);
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    deviceFingerprintHash: text('device_fingerprint_hash').notNull(),
    name: text('name').notNull(),
    platform: text('platform').notNull(),
    appVersion: text('app_version'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('devices_user_fingerprint_unique').on(t.userId, t.deviceFingerprintHash)],
);
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  status: orderStatus('status').notNull(),
  kind: text('kind').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  externalReference: text('external_reference'),
  metadata: jsonb('metadata').default({}).notNull(),
  ...timestamps,
});
export const aiProviders = pgTable(
  'ai_providers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').default('openai-compatible').notNull(),
    baseUrl: text('base_url').notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    configured: boolean('configured').default(false).notNull(),
    config: jsonb('config').default({}).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('ai_providers_code_unique').on(t.code)],
);
export const aiModels = pgTable(
  'ai_models',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerId: uuid('provider_id')
      .references(() => aiProviders.id, { onDelete: 'cascade' })
      .notNull(),
    externalId: text('external_id').notNull(),
    displayName: text('display_name').notNull(),
    capabilities: jsonb('capabilities').$type<string[]>().default([]).notNull(),
    pricing: jsonb('pricing').default({}).notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('ai_models_provider_external_unique').on(t.providerId, t.externalId)],
);
export const providerModels = pgTable(
  'provider_models',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerId: uuid('provider_id')
      .references(() => aiProviders.id, { onDelete: 'cascade' })
      .notNull(),
    modelId: text('model_id').notNull(),
    displayName: text('display_name').notNull(),
    modality: text('modality').notNull(),
    capabilities: jsonb('capabilities').$type<string[]>().default([]).notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    inputCost: numeric('input_cost', { precision: 18, scale: 6 }),
    outputCost: numeric('output_cost', { precision: 18, scale: 6 }),
    currency: text('currency'),
    pricingUnit: text('pricing_unit'),
    metadata: jsonb('metadata').default({}).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('provider_models_provider_model_unique').on(t.providerId, t.modelId)],
);
export const logicalModels = pgTable(
  'logical_models',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    displayName: text('display_name').notNull(),
    type: text('type').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('logical_models_key_unique').on(t.key)],
);
export const modelBindings = pgTable(
  'model_bindings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    logicalModelId: uuid('logical_model_id')
      .references(() => logicalModels.id, { onDelete: 'cascade' })
      .notNull(),
    providerModelId: uuid('provider_model_id')
      .references(() => providerModels.id, { onDelete: 'cascade' })
      .notNull(),
    priority: integer('priority').default(1).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('model_bindings_logical_provider_unique').on(t.logicalModelId, t.providerModelId),
    index('model_bindings_priority_idx').on(t.logicalModelId, t.priority),
  ],
);
export const promptTemplates = pgTable(
  'prompt_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    category: text('category').notNull(),
    scene: text('scene').notNull(),
    style: text('style').notNull(),
    prompt: text('prompt').notNull(),
    negativePrompt: text('negative_prompt').default('').notNull(),
    supportedModels: jsonb('supported_models').$type<string[]>().default([]).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    ...timestamps,
  },
  (t) => [index('prompt_templates_category_idx').on(t.category)],
);
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: text('project_id').notNull(),
    role: assetRole('asset_role').default('INPUT').notNull(),
    uploadStatus: assetUploadStatus('upload_status').default('LOCAL').notNull(),
    mimeType: text('mime_type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    objectKey: text('object_key'),
    remoteReferenceId: text('remote_reference_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}).notNull(),
    ...timestamps,
  },
  (t) => [
    index('assets_user_project_idx').on(t.userId, t.projectId),
    index('assets_project_role_idx').on(t.projectId, t.role),
  ],
);
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    type: taskType('type').notNull(),
    status: taskStatus('status').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    error: jsonb('error'),
    pricingSnapshot: jsonb('pricing_snapshot').default({}).notNull(),
    reservedCredits: bigint('reserved_credits', { mode: 'number' }).default(0).notNull(),
    consumedCredits: bigint('consumed_credits', { mode: 'number' }).default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('tasks_user_idempotency_unique').on(t.userId, t.idempotencyKey),
    index('tasks_user_status_idx').on(t.userId, t.status),
  ],
);
export const taskRuns = pgTable(
  'task_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: uuid('provider_id').references(() => aiProviders.id),
    modelId: uuid('model_id').references(() => aiModels.id),
    attempt: integer('attempt').notNull(),
    providerTaskId: text('provider_task_id'),
    status: taskStatus('status').notNull(),
    routeSnapshot: jsonb('route_snapshot').default({}).notNull(),
    costSnapshot: jsonb('cost_snapshot').default({}).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('task_runs_task_attempt_unique').on(t.taskId, t.attempt)],
);
export const providerUsage = pgTable(
  'provider_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: uuid('provider_id')
      .references(() => aiProviders.id)
      .notNull(),
    providerModelId: uuid('provider_model_id')
      .references(() => providerModels.id)
      .notNull(),
    logicalModel: text('logical_model').notNull(),
    workflow: text('workflow').notNull(),
    status: text('status').notNull(),
    attempt: integer('attempt').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    providerRequestId: text('provider_request_id'),
    estimatedCost: numeric('estimated_cost', { precision: 18, scale: 6 }),
    actualCost: numeric('actual_cost', { precision: 18, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('provider_usage_provider_created_idx').on(t.providerId, t.createdAt),
    index('provider_usage_task_idx').on(t.taskId),
  ],
);
