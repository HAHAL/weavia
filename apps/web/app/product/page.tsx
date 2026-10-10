'use client';
import { useEffect, useState } from 'react';
type Workspace = { id: string; name: string; slug: string };
export default function ProductPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]); const [name, setName] = useState(''); const [message, setMessage] = useState('');
  const token = () => localStorage.getItem('weavia.accessToken') ?? '';
  async function load() { const response = await fetch('/api/workspaces', { headers: { authorization: `Bearer ${token()}` } }); if (response.ok) return (await response.json()).data as Workspace[]; return []; }
  useEffect(() => { async function initialLoad() { const response = await fetch('/api/workspaces', { headers: { authorization: `Bearer ${localStorage.getItem('weavia.accessToken') ?? ''}` } }); if (response.ok) setWorkspaces((await response.json()).data); } void initialLoad(); }, []);
  async function create(event: React.FormEvent) { event.preventDefault(); const response = await fetch('/api/workspaces', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}` }, body: JSON.stringify({ name }) }); if (!response.ok) { setMessage('创建失败，请先登录'); return; } setName(''); setMessage('工作空间已创建'); setWorkspaces(await load()); }
  return <main className="content-page"><p className="kicker">PRODUCT CENTER</p><h1>从工作空间到商品素材。</h1><p>商品数据按 Workspace → Project → Product → SKU → Asset 组织，生成任务和作品会关联回具体 SKU。</p><form className="auth-card" onSubmit={create}><label>新工作空间<input value={name} onChange={(e) => setName(e.target.value)} required /></label><button type="submit">创建</button>{message && <p>{message}</p>}</form><section className="feature-grid">{workspaces.map((workspace) => <article key={workspace.id}><h2>{workspace.name}</h2><p>{workspace.slug}</p></article>)}</section></main>;
}
