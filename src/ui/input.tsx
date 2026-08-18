import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-[var(--size-touch)] w-full rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-3 text-[15px] leading-[1.5] text-ink placeholder:text-ink-faint focus-visible:border-accent",
        className,
      )}
      {...props}
    />
  );
}
