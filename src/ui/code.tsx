import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/ui/copy-button";

interface CodeProps {
  value: string;
  className?: string;
  children?: ReactNode;
}

function Code({ value, className, children }: CodeProps) {
  return (
    <div
      className={cn(
        "relative overflow-x-auto rounded-[var(--radius-control)] bg-surface-2 p-3 font-mono text-[13px] leading-[1.5] text-ink",
        className,
      )}
    >
      <div className="absolute top-1 right-1">
        <CopyButton value={value} />
      </div>
      <pre className="overflow-x-auto pr-10 whitespace-pre-wrap">{children ?? value}</pre>
    </div>
  );
}

export { Code, type CodeProps };
