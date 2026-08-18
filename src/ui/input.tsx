import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-3 text-[15px] text-ink placeholder:text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}
