import Link from 'next/link';
import { ReceiptText } from 'lucide-react';
export default function OrdersPage() { return <main className="wb-page"><header className="wb-page-head"><div><p className="wb-eyebrow">YOUR ORDERS</p><h1>订单<span className="wb-gold">.</span></h1><p>会员与额度购买记录会显示在这里。</p></div></header><div className="wb-empty wb-empty--large"><div className="wb-empty-icon"><ReceiptText size={28} /></div><h2>暂无在线订单</h2><p>在线购买功能开放后，可在这里查看订单。</p><Link href="/membership" className="wb-button wb-button-dark">查看会员方案</Link></div></main>; }
