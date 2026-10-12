'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, UserRound } from 'lucide-react';
import { apiGet, type User } from '../../lib/workbench';

export default function SettingsPage() {
  const [user, setUser] = useState<User>();
  const [error, setError] = useState('');
  useEffect(() => { void apiGet<User>('/auth/me').then(setUser).catch((e: Error) => setError(e.message)); }, []);
  function signOut() { localStorage.removeItem('weavia.accessToken'); localStorage.removeItem('weavia.refreshToken'); window.location.assign('/login'); }
  return <main className="wb-page"><header className="wb-page-head"><div><p className="wb-eyebrow">ACCOUNT SETTINGS</p><h1>设置<span className="wb-gold">.</span></h1><p>管理你的 WEAVIA 账户。</p></div></header>{error && <p className="wb-error" role="alert">{error}</p>}<section className="wb-settings-card"><div className="wb-empty-icon"><UserRound size={22} /></div><div><span>个人资料</span><h2>{user?.name || 'WEAVIA 用户'}</h2><p>{user?.email || '登录后可查看账户信息'}</p></div></section><div className="wb-settings-actions"><Link href="/membership">查看会员信息 <ArrowUpRight size={16} /></Link><Link href="/credits">查看创作额度 <ArrowUpRight size={16} /></Link><button onClick={signOut}>退出登录</button></div></main>;
}
