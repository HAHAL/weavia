import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { clsx } from 'clsx';

export function Button({ className, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={clsx('wv-button', `wv-button--${variant}`, className)} {...props} />;
}
export function Card({ className, ...props }: PropsWithChildren<{ className?: string }>) { return <section className={clsx('wv-card', className)} {...props} />; }
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={clsx('wv-input', className)} {...props} />; }
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="wv-page-header"><div>{eyebrow && <p className="wv-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="wv-empty"><span className="wv-empty__mark" aria-hidden="true">W</span><h2>{title}</h2><p>{description}</p>{action}</div>;
}
export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'success' | 'warning' | 'error' | 'accent' }>) { return <span className={`wv-badge wv-badge--${tone}`}>{children}</span>; }
