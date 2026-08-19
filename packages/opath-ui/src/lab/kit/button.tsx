import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../cn";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-[var(--radius-control)] text-[13px] font-[510] outline-none transition-[background-color,color,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:opacity-50 active:scale-[0.97] focus-visible:shadow-[var(--focus-ring)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-on-accent hover:bg-accent-hover",
        outline:
          "border border-hairline bg-surface-1 text-ink hover:bg-surface-2 active:bg-surface-3",
        secondary:
          "border border-hairline bg-surface-1 text-ink hover:bg-surface-2 active:bg-surface-3",
        ghost: "text-ink hover:bg-surface-2 active:bg-surface-3",
        destructive: "bg-destructive text-on-accent",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[var(--size-touch)] px-4",
        xs: "min-h-8 px-2 text-[12px]",
        sm: "min-h-10 px-3",
        lg: "min-h-12 px-5 text-[15px]",
        icon: "size-11 px-0",
        "icon-xs": "size-8 px-0",
        "icon-sm": "size-10 px-0",
        "icon-lg": "size-12 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, size }), className)}
      data-slot="button"
      {...props}
    />
  );
}

export { Button, buttonVariants };
