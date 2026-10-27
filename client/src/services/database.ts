import { isTauri } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { useApp } from '../stores/app';
import { currentScope } from '../stores/scope';
import { log } from '../lib/logger';
export async function initDatabase() {
 if (!isTauri()) return;
 try {
  const db = await Database.load('sqlite:weavia.db');
  await db.execute('CREATE TABLE IF NOT EXISTS account_state (account TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  useApp.subscribe(state => {
   clearTimeout(timer);
   const account=currentScope();
   if(account==='anonymous') return;
   const data=JSON.stringify({products:state.products,assets:state.assets,tasks:state.tasks,works:state.works});
   timer=setTimeout(()=>{ queue=queue.then(async()=>{await db.execute('INSERT OR REPLACE INTO account_state(account,data,updated_at) VALUES(?,?,?)',[account,data,new Date().toISOString()]);}).catch(()=>{log('error','database.write');}); },250);
  });
  log('info','database.ready','account_state');
 } catch { log('error','database.init'); }
}
