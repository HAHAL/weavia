import Link from 'next/link';
import { Card } from '@weavia/ui';

export default function AccountPage(){return <main className="content-page"><p className="kicker">ACCOUNT</p><h1>用户中心</h1><p>账户资料、会员、Credits、订单和登录设备的统一入口。</p><section className="feature-grid"><Card><h2>工作空间</h2><p>管理商品项目与团队工作空间。</p><Link href="/account/workspaces">查看工作空间</Link></Card><Card><h2>Credits 钱包</h2><p>查看当前余额与使用流水。</p><Link href="/credits">查看 Credits</Link></Card><Card><h2>当前套餐与设备</h2><p>订阅和设备管理将在后续阶段接入。</p></Card></section></main>}
