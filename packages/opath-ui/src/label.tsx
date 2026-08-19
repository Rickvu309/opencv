import type { LabelHTMLAttributes } from "react";
import { cn } from "./cn";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1 block text-[13px] font-[510] text-ink", className)} {...props} />
  );
}
