'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Crown } from 'lucide-react';
import { apiGet, formatDate, planName, type Membership } from '../../lib/workbench';

export default function MembershipPage() {
  const [membership, setMembership] = useState<Membership>();
  const [error, setError] = useState('');
  useEffect(() => { void apiGet<Membership>('/membership').then(setMembership).catch((e: Error) => setError(e.message)); }, []);
  return <main className="wb-page"><header className="wb-page-head"><div><p className="wb-eyebrow">YOUR MEMBERSHIP</p><h1>会员中心<span className="wb-gold">.</span></h1><p>为每个阶段的创作，找到合适的节奏。</p></div></header>{error && <p className="wb-error" role="alert">{error}</p>}<div className="wb-membership-card"><Crown size={27} /><span>YOUR CURRENT PLAN</span><h2>{planName(membership)}</h2><p>{membership?.currentPeriodEnd ? `有效期至 ${formatDate(membership.currentPeriodEnd)}` : '当前套餐'}</p><Link href="/pricing" className="wb-button wb-button-light">了解会员方案 <ArrowUpRight size={16} /></Link></div><p className="wb-fine-print">在线购买和升级即将开放。现阶段可先查看会员方案。</p></main>;
}
