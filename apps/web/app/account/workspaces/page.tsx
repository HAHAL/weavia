'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Input } from '@weavia/ui';
import Link from 'next/link';

type Workspace = { id: string; name: string; slug: string };

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const token = () => localStorage.getItem('weavia.accessToken') ?? '';

  async function load() {
    const response = await fetch('/api/workspaces', { headers: { authorization: `Bearer ${token()}` } });
    if (response.ok) setWorkspaces((await response.json()).data as Workspace[]);
  }

  useEffect(() => {
    async function initialLoad() {
      const accessToken = localStorage.getItem('weavia.accessToken') ?? '';
      const response = await fetch('/api/workspaces', { headers: { authorization: `Bearer ${accessToken}` } });
      if (response.ok) setWorkspaces((await response.json()).data as Workspace[]);
    }
    void initialLoad();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/workspaces', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}` }, body: JSON.stringify({ name }) });
    if (!response.ok) { setMessage('创建失败，请先登录'); return; }
    setName('');
    setMessage('工作空间已创建');
    await load();
  }

  return <main className="content-page"><p className="kicker">WORKSPACES</p><h1>工作空间</h1><p>管理你的商品项目与团队工作空间。</p><form className="auth-card" onSubmit={create}><label htmlFor="workspace-name">新工作空间</label><Input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} required /><Button type="submit">创建</Button>{message && <p role="status">{message}</p>}</form><section className="feature-grid" aria-label="工作空间列表">{workspaces.map((workspace) => <Card key={workspace.id}><h2>{workspace.name}</h2><p>{workspace.slug}</p></Card>)}</section><Link href="/account">返回用户中心</Link></main>;
}
