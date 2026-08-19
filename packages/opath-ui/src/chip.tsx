import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type ChipTone = "quiet" | "status" | "code";
type ChipStatus = "progress" | "positive" | "attention" | "muted";

const statusDot: Record<ChipStatus, string> = {
  progress: "bg-status-progress",
  positive: "bg-status-positive",
  attention: "bg-status-attention",
  muted: "bg-ink-muted",
};

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  status?: ChipStatus;
  children: ReactNode;
}

function Chip({ tone = "quiet", status, className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-1 text-[13px] leading-[1.5]",
        tone === "quiet" && "border border-hairline text-ink-secondary",
        tone === "status" && "border border-hairline text-ink",
        tone === "code" &&
          "rounded-[var(--radius-tag)] bg-surface-2 font-mono text-[12px] text-ink",
        className,
      )}
      {...props}
    >
      {tone === "status" && status ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[status])} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}

export { Chip, type ChipProps, type ChipTone, type ChipStatus };
