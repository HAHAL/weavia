import { isTauri } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { useApp } from '../stores/app';
import { log } from '../lib/logger';

type Snapshot = Pick<ReturnType<typeof useApp.getState>, 'products' | 'assets' | 'tasks' | 'works' | 'enabledSkills' | 'theme' | 'collapsed'>;

let db: Database | null = null;
let writeTimer: number | undefined;
let pending: Snapshot | null = null;
let lastSerialized = '';
let writeQueue = Promise.resolve();

const WRITE_DELAY_MS = 250;

function snapshotOf(state: ReturnType<typeof useApp.getState>): Snapshot {
  return { products: state.products, assets: state.assets, tasks: state.tasks, works: state.works, enabledSkills: state.enabledSkills, theme: state.theme, collapsed: state.collapsed };
}

function scheduleWrite(snapshot: Snapshot) {
  // Skip identical snapshots (toast and other UI-only updates) and debounce
  // bursts such as task progress so SQLite is not rewritten per keystroke.
  const serialized = JSON.stringify(snapshot);
  if (serialized === lastSerialized) return;
  lastSerialized = serialized;
  pending = snapshot;
  if (writeTimer) window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => { writeTimer = undefined; void flushWrites(); }, WRITE_DELAY_MS);
}

async function flushWrites() {
  const database = db;
  const snapshot = pending;
  if (!database || !snapshot) return;
  pending = null;
  const data = JSON.stringify(snapshot);
  writeQueue = writeQueue
    .then(async () => { await database.execute('INSERT OR REPLACE INTO client_state (id,data,updated_at) VALUES (1,?,?)', [data, new Date().toISOString()]); })
    .catch(() => { lastSerialized = ''; log('error', 'database.write'); });
  await writeQueue;
}

export async function initDatabase() {
  if (!isTauri()) return;
  try {
    db = await Database.load('sqlite:weavia.db');
    await db.execute('CREATE TABLE IF NOT EXISTS client_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    await db.execute('CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await db.execute("INSERT OR REPLACE INTO schema_meta (key,value) VALUES ('schema_version','1')");

    const rows = await db.select<{ data: string }[]>('SELECT data FROM client_state WHERE id = 1');
    if (rows[0]) {
      const state = JSON.parse(rows[0].data) as Snapshot;
      state.tasks = state.tasks.map(t => (['Queued', 'Running'].includes(t.status) ? { ...t, status: 'Failed' as const, error: '演示任务因客户端关闭而中断' } : t));
      useApp.setState(state);
      lastSerialized = JSON.stringify(snapshotOf(useApp.getState()));
    }

    useApp.subscribe(state => {
      if (!db) return;
      scheduleWrite(snapshotOf(state));
    });

    // Flush the last debounced snapshot when the window is hidden/closed.
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { if (writeTimer) window.clearTimeout(writeTimer); writeTimer = undefined; void flushWrites(); }
    });

    log('info', 'database.ready', 'sqlite:weavia.db');
  } catch {
    log('error', 'database.init');
  }
}
