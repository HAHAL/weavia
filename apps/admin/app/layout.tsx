import type { Metadata } from 'next';
import { Suspense } from 'react';
import './admin.css';
import { AdminShell } from '../components/admin-shell';

export const metadata: Metadata = { title: 'WEAVIA Admin', description: 'WEAVIA 运营管理后台' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AdminShell>
          <Suspense fallback={<div className="admin-content">正在加载...</div>}>
            {children}
          </Suspense>
        </AdminShell>
      </body>
    </html>
  );
}
