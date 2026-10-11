'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  label?: string;
}

export function Tabs({ items, value, defaultValue, onValueChange, className, label }: TabsProps) {
  const id = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? items.find((item) => !item.disabled)?.value);
  const selected = value ?? internalValue;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(next: string) {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = items.map((item, i) => !item.disabled ? i : -1).filter((i) => i >= 0);
    if (!enabled.length) return;
    const position = enabled.indexOf(index);
    const nextIndex = event.key === 'Home' ? enabled[0]
      : event.key === 'End' ? enabled[enabled.length - 1]
        : enabled[(position + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    if (nextIndex === undefined || !items[nextIndex]) return;
    select(items[nextIndex].value);
    refs.current[nextIndex]?.focus();
  }

  return <div className={clsx('wv-tabs', className)}><div className="wv-tabs__list" role="tablist" aria-label={label}>
    {items.map((item, index) => <button key={item.value} ref={(node) => { refs.current[index] = node; }} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={selected === item.value} tabIndex={selected === item.value ? 0 : -1} disabled={item.disabled} onClick={() => select(item.value)} onKeyDown={(event) => onKeyDown(event, index)}>{item.label}</button>)}
  </div>{items.map((item, index) => <div key={item.value} className="wv-tabs__panel" role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} tabIndex={0} hidden={selected !== item.value}>{selected === item.value ? item.content : null}</div>)}</div>;
}
