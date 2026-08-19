import { ChevronDownIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../cn';

type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  size?: 'sm' | 'default';
};

function NativeSelect({
  className,
  size = 'default',
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        'group/native-select relative w-fit has-[select:disabled]:opacity-50',
        className
      )}
      data-size={size}
      data-slot="native-select-wrapper"
    >
      <select
        className="min-h-[var(--size-touch)] w-full min-w-0 select-none appearance-none rounded-[var(--radius-control)] border border-hairline bg-surface-1 py-1 pr-8 pl-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus-visible:border-accent focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive data-[size=sm]:min-h-10"
        data-size={size}
        data-slot="native-select"
        {...props}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2.5 size-4 select-none text-ink-muted"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<'option'>) {
  return (
    <option
      className={cn('bg-[Canvas] text-[CanvasText]', className)}
      data-slot="native-select-option"
      {...props}
    />
  );
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<'optgroup'>) {
  return (
    <optgroup
      className={cn('bg-[Canvas] text-[CanvasText]', className)}
      data-slot="native-select-optgroup"
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
