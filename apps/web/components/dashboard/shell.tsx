import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';

export function WorkbenchShell({ children }: { children: ReactNode }) {
  return <div className="wb-shell"><Sidebar /><div className="wb-main"><div className="wb-mobile-brand">WEAVIA <span>织维</span></div>{children}</div></div>;
}
