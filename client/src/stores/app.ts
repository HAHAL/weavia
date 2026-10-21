import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Asset, Product, Task, Work } from '../types';
import { log } from '../lib/logger';
type Theme = 'light' | 'cream' | 'dark';
type AppState = { collapsed: boolean; theme: Theme; products: Product[]; assets: Asset[]; tasks: Task[]; works: Work[]; enabledSkills: string[]; toast: string | null; setCollapsed: (v: boolean) => void; setTheme: (v: Theme) => void; notify: (v: string) => void; addProduct: (v: Product) => void; addAsset: (v: Asset) => void; deleteAsset: (id: string) => void; submitTask: (v: Task) => void; updateTask: (id: string, patch: Partial<Task>) => void; addWork: (v: Work) => void; updateWork: (v: Work) => void; toggleSkill: (id: string) => void };
export const useApp = create<AppState>()(persist((set) => ({
  collapsed: false, theme: 'light', products: [], assets: [], tasks: [], works: [], enabledSkills: ['hero','scene','variant'], toast: null,
  setCollapsed: (collapsed) => set({ collapsed }), setTheme: (theme) => set({ theme }), notify: (toast) => set({ toast }),
  addProduct: (p) => { set(s => ({ products: [p,...s.products] })); log('info','product.created',p.id); },
  addAsset: (a) => { set(s => ({ assets: [a,...s.assets] })); log('info','asset.imported',`${a.id} ${a.mime}`); },
  deleteAsset: (id) => { set(s => ({ assets: s.assets.filter(a => a.id !== id) })); log('info','asset.deleted',id); },
  submitTask: (task) => { set(s => ({ tasks: [task,...s.tasks] })); log('info','task.queued',task.id); },
  updateTask: (id, patch) => { set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t,...patch } : t) })); if (patch.status) log('info','task.status',`${id} ${patch.status}`); },
  addWork: (work) => set(s => ({ works: [work,...s.works] })),
  updateWork: (work) => set(s => ({ works: s.works.map(w => w.id === work.id ? work : w) })),
  toggleSkill: (id) => set(s => ({ enabledSkills: s.enabledSkills.includes(id) ? s.enabledSkills.filter(x => x !== id) : [...s.enabledSkills,id] }))
}), { name: 'weavia.state.v1', partialize: s => ({ collapsed:s.collapsed,theme:s.theme,products:s.products,assets:s.assets,tasks:s.tasks,works:s.works,enabledSkills:s.enabledSkills }) }));
