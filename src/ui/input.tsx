import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3 text-[16px]",
        className,
      )}
      {...props}
    />
  );
}
