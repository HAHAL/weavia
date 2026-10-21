'use client';

import { useEffect, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface ToastProps {
  title: string;
  description?: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'error';
  onDismiss?: () => void;
  duration?: number;
  className?: string;
}

export function Toast({ title, description, tone = 'info', onDismiss, duration = 5000, className }: ToastProps) {
  useEffect(() => {
    if (!onDismiss || duration <= 0 || tone === 'error') return;
    const timeout = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onDismiss, tone]);

  return <div className={clsx('wv-toast', `wv-toast--${tone}`, className)} role={tone === 'error' ? 'alert' : 'status'}><div><strong>{title}</strong>{description && <p>{description}</p>}</div>{onDismiss && <button type="button" aria-label="关闭通知" onClick={onDismiss}>×</button>}</div>;
}
