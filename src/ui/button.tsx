import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const styles = cva(
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-4 text-[14px] font-medium transition-colors disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-destructive text-white",
        outline: "border border-border bg-background",
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
