'use client';
import { useEffect, useState } from 'react';
type Account = { available: number; reserved: number; currency: string };
type Transaction = { id: string; type: string; availableDelta: number; reservedDelta: number; createdAt: string };
export default function CreditsPage() {
  const [account, setAccount] = useState<Account>(); const [transactions, setTransactions] = useState<Transaction[]>([]); const [error, setError] = useState('');
  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('weavia.accessToken');
      if (!token) throw new Error('请先登录');
      const headers = { authorization: `Bearer ${token}` };
      const [a, t] = await Promise.all([fetch('/api/credits', { headers }), fetch('/api/credits/transactions', { headers })]);
      if (!a.ok || !t.ok) throw new Error('加载 Credits 失败');
      setAccount((await a.json()).data); setTransactions((await t.json()).data);
    }
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : '加载失败'));
  }, []);
  return <main className="content-page"><p className="kicker">CREDITS LEDGER</p><h1>每一次消耗，都可追踪。</h1>{error && <p className="auth-error">{error}</p>}{account && <section className="feature-grid"><article><h2>{account.available}</h2><p>可用 Credits</p></article><article><h2>{account.reserved}</h2><p>任务预占</p></article></section>}<section><h2>最近流水</h2>{transactions.map((item) => <article key={item.id}><strong>{item.type}</strong><span> 可用 {item.availableDelta >= 0 ? '+' : ''}{item.availableDelta} / 预占 {item.reservedDelta >= 0 ? '+' : ''}{item.reservedDelta}</span><small>{new Date(item.createdAt).toLocaleString()}</small></article>)}</section></main>;
}
