import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const styles = cva(
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-4 text-[13px] font-[510] transition-[background-color,color,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover",
        ghost: "text-ink hover:bg-surface-2 active:bg-surface-3",
        danger: "bg-destructive text-on-accent",
        outline: "border border-hairline bg-surface-1 text-ink hover:bg-surface-2 active:bg-surface-3",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  className,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof styles>) {
  return <button className={cn(styles({ variant }), className)} {...props} />;
}
