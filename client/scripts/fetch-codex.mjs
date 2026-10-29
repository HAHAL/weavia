// Downloads the pinned Codex CLI release into src-tauri/resources so the bundle
// ships a working engine. The binary itself is gitignored (~250 MB).
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const VERSION = process.env.CODEX_VERSION || 'rust-v0.165.0';
const ASSET = 'codex-aarch64-apple-darwin.tar.gz';
const URL = `https://github.com/openai/codex/releases/download/${VERSION}/${ASSET}`;
const root = join(process.cwd(), 'src-tauri', 'resources');
const target = join(root, 'codex');

if (existsSync(target)) {
  console.log(`[fetch-codex] already present: ${target}`);
  process.exit(0);
}
mkdirSync(root, { recursive: true });
console.log(`[fetch-codex] downloading ${URL}`);
const response = await fetch(URL, { redirect: 'follow' });
if (!response.ok || !response.body) {
  console.error(`[fetch-codex] download failed: HTTP ${response.status}`);
  process.exit(1);
}
const archive = join(root, '.codex-download.tar.gz');
await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
const untar = spawnSync('tar', ['-xzf', archive, '-C', root], { stdio: 'inherit' });
if (untar.status !== 0) process.exit(untar.status ?? 1);
const extracted = join(root, 'codex-aarch64-apple-darwin');
const move = spawnSync('mv', [extracted, target], { stdio: 'inherit' });
if (move.status !== 0) process.exit(move.status ?? 1);
spawnSync('chmod', ['755', target]);
spawnSync('rm', ['-f', archive]);
console.log(`[fetch-codex] ready: ${target}`);
