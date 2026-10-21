'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  closeLabel?: string;
}

export function Modal({ open, onClose, title, description, children, footer, className, closeLabel = '关闭' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog ref={dialogRef} className={clsx('wv-modal', className)} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="wv-modal__header"><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><button className="wv-modal__close" type="button" aria-label={closeLabel} onClick={onClose}>×</button></div>
    <div className="wv-modal__body">{children}</div>
    {footer && <div className="wv-modal__footer">{footer}</div>}
  </dialog>;
}
