import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
export function createDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required to create a database connection');
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
export * from './schema';
