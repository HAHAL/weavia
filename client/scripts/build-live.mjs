// Build the desktop client against a real API. Running plain `vite build`
// silently produces a mock bundle that cannot log in, so releases must go
// through this script.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const apiBase = process.env.VITE_API_BASE_URL || 'http://8.160.190.182:8080';
const env = {
  ...process.env,
  VITE_API_MODE: 'live',
  VITE_API_BASE_URL: apiBase,
  VITE_ENABLE_VIDEO: process.env.VITE_ENABLE_VIDEO || 'false',
};

console.log(`[build-live] mode=live api=${apiBase} video=${env.VITE_ENABLE_VIDEO}`);

for (const args of [['tsc', '-b'], ['vite', 'build']]) {
  const step = spawnSync('npx', args, { stdio: 'inherit', env });
  if (step.status !== 0) process.exit(step.status ?? 1);
}

const assetsDir = join(process.cwd(), 'dist', 'assets');
const bundles = readdirSync(assetsDir).filter(name => /^index-.*\.js$/.test(name));
if (!bundles.length) {
  console.error('[build-live] no index bundle found in dist/assets');
  process.exit(1);
}

// The API base URL is inlined into the bundle; its presence proves the build
// was configured for a live backend rather than the localhost default.
const host = apiBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
const source = bundles.map(name => readFileSync(join(assetsDir, name), 'utf8')).join('\n');
if (!source.includes(host)) {
  console.error(`[build-live] bundle is missing the API host ${host}`);
  process.exit(1);
}

writeFileSync(
  join(process.cwd(), 'dist', 'build-info.json'),
  JSON.stringify({ mode: 'live', apiBase, video: env.VITE_ENABLE_VIDEO, builtAt: new Date().toISOString() }, null, 2),
);
console.log('[build-live] ok: live bundle verified');
