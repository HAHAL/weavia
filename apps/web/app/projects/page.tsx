'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X, FolderOpen } from 'lucide-react';
import { ProjectCard } from '../../components/dashboard/cards';
import { apiGet, apiPost, type Project, type Workspace } from '../../lib/workbench';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void Promise.all([apiGet<Project[]>('/projects'), apiGet<Workspace[]>('/workspaces')]).then(([p, w]) => { setProjects(p); setWorkspaces(w); setWorkspaceId(w[0]?.id ?? ''); }).catch((e: Error) => setError(e.message)); }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let target = workspaceId;
      if (!target) { const created = await apiPost<Workspace>('/workspaces', { name: '我的创作空间' }); target = created.id; setWorkspaces([created]); setWorkspaceId(target); }
      await apiPost<Project>(`/workspaces/${target}/projects`, { name: name.trim(), description: '' });
      setProjects(await apiGet<Project[]>('/projects')); setName(''); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : '创建失败'); } finally { setBusy(false); }
  }
  return <main className="wb-page"><header className="wb-page-head"><div><p className="wb-eyebrow">YOUR PROJECTS</p><h1>我的项目<span className="wb-gold">.</span></h1><p>让每个商品系列，都有自己的创作空间。</p></div><button className="wb-button wb-button-dark" onClick={() => setOpen(true)}><Plus size={17} /> 新建项目</button></header>{error && <p className="wb-error" role="alert">{error}</p>}{projects.length ? <div className="wb-project-grid wb-project-grid--page">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="wb-empty wb-empty--large"><div className="wb-empty-icon"><FolderOpen size={28} /></div><h2>开始你的第一个项目</h2><p>集中管理商品、创作内容与最终素材。</p><button className="wb-button wb-button-dark" onClick={() => setOpen(true)}><Plus size={17} /> 新建项目</button></div>}
    {open && <div className="wb-modal-backdrop" role="presentation" onClick={() => setOpen(false)}><div className="wb-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title" onClick={(event) => event.stopPropagation()}><button className="wb-modal-close" onClick={() => setOpen(false)} aria-label="关闭"><X size={20} /></button><p className="wb-eyebrow">NEW PROJECT</p><h2 id="create-project-title">创建新项目</h2><p>为一个商品系列建立专属空间。</p><form onSubmit={create}><label htmlFor="project-name">项目名称</label><input id="project-name" autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：春季女装系列" />{workspaces.length > 1 && <><label htmlFor="project-space">所属团队</label><select id="project-space" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></>}<button disabled={busy || !name.trim()} className="wb-button wb-button-dark">{busy ? '正在创建…' : '创建项目'}</button></form></div></div>}</main>;
}
