import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type AnchorHTMLAttributes } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  // Primary is the glow. Never a black primary.
  primary: 'glow-button text-[#1B1B1F] shadow-glow ring-1 ring-inset ring-white/70 hover:shadow-glow-lg hover:brightness-[0.97] active:brightness-[0.94] active:shadow-none disabled:bg-chip disabled:[background-image:none] disabled:text-fg-3 disabled:shadow-none disabled:ring-0',
  secondary: 'bg-surface text-fg ring-1 ring-inset ring-border hover:bg-subtle active:bg-chip disabled:text-fg-3 disabled:bg-surface',
  ghost: 'bg-transparent text-fg hover:bg-subtle active:bg-chip disabled:text-fg-3 disabled:bg-transparent',
  danger: 'bg-danger text-white hover:bg-[#E04848] active:bg-[#CC3F3F] disabled:bg-danger-soft disabled:text-danger/60',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 gap-1.5 rounded-row text-body',
  md: 'h-8 px-3 gap-1.5 rounded-btn text-body',
  lg: 'h-11 px-5 gap-2 rounded-full text-[15px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  /** Keyboard hint shown at the end, like "N". */
  kbd?: string;
}

/** One primary per view. Secondary for the rest, ghost in toolbars, danger only to delete. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, kbd, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,box-shadow,filter] duration-150 disabled:cursor-not-allowed active:scale-[0.98]',
        VARIANT[variant], SIZE[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : icon}
      {children && <span className={cn(loading && 'opacity-70')}>{children}</span>}
      {kbd && (
        <kbd className={cn('ml-0.5 rounded-[4px] px-1 font-sans text-[11px] font-medium', variant === 'primary' ? 'bg-[#1B1B1F0F] text-[#1B1B1F80]' : 'bg-chip text-fg-3')}>{kbd}</kbd>
      )}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 24 | 28 | 32;
  selected?: boolean;
  /** Required: icon buttons always have an accessible name. */
  label: string;
}

/** Toolbar and header actions. Always labelled, shows the label as a tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 28, selected, label, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      aria-pressed={selected || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-fg-2 transition-colors duration-150 hover:bg-subtle active:bg-chip disabled:text-placeholder disabled:bg-transparent [&_svg]:size-3.5',
        size === 24 && 'size-6 rounded-row', size === 28 && 'size-7 rounded-row', size === 32 && 'size-8 rounded-btn [&_svg]:size-4',
        selected && 'bg-active text-fg hover:bg-active',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

type LinkKind = 'inline' | 'chevron' | 'muted';

/** Text actions in copy and section headers. */
export function TextLink({ kind = 'inline', className, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { kind?: LinkKind }) {
  return (
    <a
      className={cn(
        'inline-flex items-center gap-1 rounded-chip',
        kind === 'inline' && 'text-fg underline underline-offset-2',
        kind === 'chevron' && 'font-medium text-fg hover:underline',
        kind === 'muted' && 'text-fg-2 hover:text-fg hover:underline',
        className,
      )}
      {...rest}
    >
      {children}
      {kind === 'chevron' && <ChevronRight className="size-3.5" aria-hidden />}
    </a>
  );
}
