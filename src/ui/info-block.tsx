import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InfoBlockProps {
  children: ReactNode;
  className?: string;
}

function InfoBlock({ children, className }: InfoBlockProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-[13px] leading-[1.5] text-ink-secondary",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { InfoBlock, type InfoBlockProps };
