import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn";

export function StoryFrame({
  children,
  className,
  style,
  width = 420,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  width?: number | string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-6 text-ink",
        className,
      )}
      style={{ width, ...style }}
    >
      {children}
    </div>
  );
}
