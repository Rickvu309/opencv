import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-[var(--radius-control)] border border-border bg-background px-3 py-2 text-[16px] leading-[1.6]",
        className,
      )}
      {...props}
    />
  );
}
