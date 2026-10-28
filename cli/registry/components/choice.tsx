import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface Option<T extends string> { value: T; label: string; icon?: ReactNode; disabled?: boolean; hint?: string }

/** Shows the current value. Opens a menu with a check on the selected option. */
export function Select<T extends string>({ value, options, onChange, label, className }: { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cn('inline-flex h-[30px] items-center gap-1.5 rounded-btn bg-surface px-2.5 text-body text-fg ring-1 ring-inset ring-border hover:bg-subtle', open && 'ring-[1.5px] ring-focus')}
      >
        {current?.icon}
        {current?.label}
        <ChevronDown className="size-3.5 text-fg-3" aria-hidden />
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-30 mt-1 min-w-44 rounded-tile bg-surface p-1 shadow-pop ring-[0.5px] ring-border">
          {options.map((o) => (
            <li key={o.value}>
              <button
                role="option"
                aria-selected={o.value === value}
                disabled={o.disabled}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn('flex h-7 w-full items-center gap-2 rounded-row px-2 text-left text-body hover:bg-subtle disabled:opacity-45', o.value === value && 'bg-subtle')}
              >
                {o.icon}
                <span className="flex-1">{o.label}</span>
                {o.hint && <span className="text-small text-fg-3">{o.hint}</span>}
                {o.value === value && <Check className="size-3.5" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Two to four options that switch a view or setting at once. */
export function Segmented<T extends string>({ value, options, onChange, label, className }: { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex h-[30px] items-center gap-0.5 rounded-tile bg-chip p-[3px]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-row px-2.5 text-[12.5px] transition-colors disabled:opacity-50',
            o.value === value ? 'bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.1)]' : 'text-fg-2 hover:bg-white/50',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Applies at once. Label the ON state: "Enable memory". */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('inline-flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40', checked ? 'justify-end bg-fg' : 'justify-start bg-active hover:bg-border-strong')}
    >
      <span className="size-3.5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, mixed, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; mixed?: boolean; disabled?: boolean }) {
  const on = checked || mixed;
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-body', disabled && 'cursor-not-allowed opacity-40')}>
      <button
        role="checkbox"
        aria-checked={mixed ? 'mixed' : checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('inline-flex size-4 items-center justify-center rounded-chip', on ? 'bg-fg' : 'bg-surface ring-1 ring-inset ring-border-strong')}
      >
        {mixed ? <span className="h-0.5 w-2 rounded bg-white" /> : checked && <Check className="size-3 text-white" strokeWidth={3} />}
      </button>
      {label}
    </label>
  );
}

export function Radio({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-body', disabled && 'cursor-not-allowed opacity-40')}>
      <button
        role="radio"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={cn('size-4 rounded-full bg-surface', checked ? 'ring-[5px] ring-inset ring-fg' : 'ring-1 ring-inset ring-border-strong')}
      />
      {label}
    </label>
  );
}
