import { cn } from "./cn";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-[var(--size-touch)] w-full min-w-0 rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-3 text-[15px] leading-[1.5] text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
