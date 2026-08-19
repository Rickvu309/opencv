import { cn } from '../../cn';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
        className={cn('skeleton-pulse rounded-[var(--radius-control)] bg-surface-2', className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
