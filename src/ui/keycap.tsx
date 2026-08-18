import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Keycap({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex min-h-6 items-center rounded-[var(--radius-tag)] border border-hairline bg-surface-1 px-1.5 font-mono text-[12px] text-ink-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

export { Keycap };
