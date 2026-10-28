import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { cn } from './cn';

/** Label above, helper below. An error replaces the helper and says how to fix it. */
export function Field({ label, helper, error, children, className }: { label: string; helper?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode; className?: string }) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-medium text-fg-2">{label}</label>
      {children(id, helper || error ? msgId : undefined)}
      {error ? (
        <p id={msgId} className="text-small text-danger">{error}</p>
      ) : helper ? (
        <p id={msgId} className="text-small text-fg-3">{helper}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-8 w-full rounded-btn bg-surface px-2.5 text-body text-fg ring-1 ring-inset ring-border outline-none transition-shadow hover:ring-border-strong focus:ring-[1.5px] focus:ring-focus disabled:bg-subtle disabled:text-fg-3',
        invalid && 'ring-danger hover:ring-danger focus:ring-danger',
        className,
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn('w-full resize-y rounded-tile bg-surface px-3 py-2.5 text-body leading-normal text-fg ring-1 ring-inset ring-border outline-none focus:ring-[1.5px] focus:ring-focus', className)}
      {...rest}
    />
  );
});

/** Filters the list below it as you type. Clear button once filled. */
export function SearchInput({ value, onChange, placeholder = 'Search', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('flex h-9 items-center gap-2 rounded-tile bg-surface px-3 ring-1 ring-inset ring-border focus-within:ring-[1.5px] focus-within:ring-focus', className)}>
      <SearchIcon className="size-[15px] shrink-0 text-fg-3" aria-hidden />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-body outline-none" />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="text-fg-3 hover:text-fg">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
