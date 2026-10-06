import { defineConfig } from 'drizzle-kit';
export default defineConfig({ schema: './src/schema.ts', out: './drizzle', dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://weavia:weavia@localhost:5432/weavia' }, strict: true, verbose: true });
