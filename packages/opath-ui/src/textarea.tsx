import { cn } from "./cn";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full min-w-0 resize-none rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-3 py-2 text-[15px] leading-[1.6] text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
