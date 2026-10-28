import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './button';

/** One question. Escape closes, focus starts inside, the page behind is inert. */
export function Dialog({ open, onClose, title, children, footer, width = 440, labelledBy }: { open: boolean; onClose: () => void; title?: string; children?: ReactNode; footer?: ReactNode; width?: number; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', esc);
    const root = ref.current;
    (root?.querySelector<HTMLElement>('[data-autofocus]') ?? root?.querySelector<HTMLElement>('button, input, textarea'))?.focus();
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-[#1A1A1A40] pt-[14vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} aria-labelledby={labelledBy} className="max-w-[calc(100vw-32px)] overflow-hidden rounded-panel bg-surface shadow-dialog ring-[0.5px] ring-border" style={{ width }}>
        {title && (
          <div className="flex flex-col gap-1.5 px-5 pt-5 pb-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-title font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="text-fg-3 hover:text-fg"><X className="size-4" /></button>
            </div>
            {children && <div className="leading-normal text-fg-2">{children}</div>}
          </div>
        )}
        {!title && children}
        {footer && <div className="flex justify-end gap-2 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Delete confirmation. Title names the thing, body says only that it is final, the button repeats the verb. */
export function ConfirmDelete({ open, onClose, onConfirm, thing, confirmLabel }: { open: boolean; onClose: () => void; onConfirm: () => void; thing: string; confirmLabel: string }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delete ${thing}?`}
      footer={<>
        <Button variant="secondary" onClick={onClose} data-autofocus>Cancel</Button>
        <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </>}
    >
      This can't be undone.
    </Dialog>
  );
}

export interface MenuEntry { label: string; icon?: ReactNode; kbd?: string; onSelect?: () => void; checked?: boolean; disabled?: boolean; destructive?: boolean; divider?: boolean }

/** Context and action menus. Destructive items sit last, after a divider. */
/** Pass onClose for a popup menu: Escape and outside clicks close it, arrows move between items. */
export function Menu({ items, className, onClose }: { items: MenuEntry[]; className?: string; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!close.current) return;
    const root = ref.current;
    root?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const out = (e: MouseEvent) => { if (!root?.parentElement?.contains(e.target as Node)) close.current?.(); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close.current?.(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  };
  return (
    <div ref={ref} role="menu" onKeyDown={onKeyDown} className={cn('w-[236px] rounded-tile bg-surface p-1 shadow-pop ring-[0.5px] ring-border', className)}>
      {items.map((it, i) => it.divider ? (
        <div key={i} className="my-1 h-px bg-border" role="separator" />
      ) : (
        <button
          key={i}
          role="menuitem"
          disabled={it.disabled}
          onClick={it.onSelect}
          className={cn('flex h-[30px] w-full items-center gap-2 rounded-row px-2 text-left text-body hover:bg-subtle disabled:opacity-45 [&>svg]:size-3.5', it.destructive ? 'text-danger [&>svg]:text-danger' : '[&>svg]:text-fg-2')}
        >
          {it.icon}
          <span className="flex-1">{it.label}</span>
          {it.checked ? <span aria-hidden>✓</span> : it.kbd && <kbd className="rounded-chip bg-chip px-[5px] font-sans text-[11px] text-fg-3">{it.kbd}</kbd>}
        </button>
      ))}
    </div>
  );
}
