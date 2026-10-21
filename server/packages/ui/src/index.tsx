import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TableHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export function Button({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return <button className={clsx('wv-button', `wv-button--${variant}`, `wv-button--${size}`, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading && <span className="wv-button__spinner" aria-hidden="true" />}{children}</button>;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={clsx('wv-card', className)} {...props} />;
}

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={clsx('wv-input', invalid && 'wv-input--invalid', className)} aria-invalid={invalid || undefined} {...props} />;
}

export function Badge({ children, className, tone = 'neutral', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'success' | 'warning' | 'error' | 'accent' | 'info' }) {
  return <span className={clsx('wv-badge', `wv-badge--${tone}`, className)} {...props}>{children}</span>;
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={clsx('wv-table', className)} {...props} />;
}

export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('wv-table-container', className)} {...props} />;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="wv-page-header"><div>{eyebrow && <p className="wv-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="wv-empty"><span className="wv-empty__mark" aria-hidden="true">W</span><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export { Modal } from './modal';
export type { ModalProps } from './modal';
export { Toast } from './toast';
export type { ToastProps } from './toast';
export { Tabs } from './tabs';
export type { TabsProps, TabItem } from './tabs';
