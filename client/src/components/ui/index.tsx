import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
const buttonVariants=cva('btn',{variants:{variant:{primary:'btn-primary',secondary:'btn-secondary',ghost:'btn-ghost',danger:'btn-danger'}},defaultVariants:{variant:'primary'}});
type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof buttonVariants>&{asChild?:boolean};
export function Button({className,variant,asChild=false,...props}:ButtonProps){const Component=asChild?Slot:'button';return <Component className={cn(buttonVariants({variant}),className)} {...props}/>;}
export function Card({ children, className='' }: PropsWithChildren<{className?:string}>) { return <section className={cn('card',className)}>{children}</section>; }
export function Badge({ children, tone='neutral' }: PropsWithChildren<{tone?:'neutral'|'success'|'warning'|'danger'|'info'}>) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function Dialog({ title, children, onClose, wide=false }: {title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) { return <DialogPrimitive.Root open onOpenChange={open=>{if(!open)onClose();}}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-backdrop"/><DialogPrimitive.Content className={cn('dialog',wide&&'dialog-wide')}><header className="dialog-header"><DialogPrimitive.Title asChild><h2>{title}</h2></DialogPrimitive.Title><DialogPrimitive.Close asChild><button className="icon-btn" aria-label="关闭"><X size={18}/></button></DialogPrimitive.Close></header>{children}</DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>; }
export function StatePanel({ type, title, detail, action }: {type:'empty'|'loading'|'error';title:string;detail?:string;action?:ReactNode}) { return <div className={`state-panel state-${type}`} role={type==='error'?'alert':'status'}><strong>{title}</strong>{detail&&<p>{detail}</p>}{action}</div>; }
export function Field({ label, children }: PropsWithChildren<{label:string}>) { return <label className="field"><span>{label}</span>{children}</label>; }
