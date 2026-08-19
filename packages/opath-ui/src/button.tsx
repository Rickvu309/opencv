import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";
import type { ButtonHTMLAttributes } from "react";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] text-[13px] font-[510] transition-[background-color,color,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover",
        ghost: "text-ink hover:bg-surface-2 active:bg-surface-3",
        danger: "bg-destructive text-on-accent",
        outline: "border border-hairline bg-surface-1 text-ink hover:bg-surface-2 active:bg-surface-3",
      },
      size: {
        md: "min-h-[var(--size-touch)] px-4",
        sm: "min-h-10 px-3",
        lg: "min-h-12 px-5 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function buttonClass(
  variant?: VariantProps<typeof buttonStyles>["variant"],
  size?: VariantProps<typeof buttonStyles>["size"],
) {
  return buttonStyles({ variant, size });
}

export function buttonAttrs({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: VariantProps<typeof buttonStyles>["variant"];
  size?: VariantProps<typeof buttonStyles>["size"];
  className?: string;
} = {}) {
  return {
    className: cn(buttonStyles({ variant, size }), className),
    "data-variant": variant,
    "data-size": size,
  };
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return (
    <button
      data-variant={variant}
      data-size={size}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}
