import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const secondaryButton =
  "bg-card text-foreground ring-1 ring-inset ring-border hover:bg-secondary active:bg-muted"

const primaryButton =
  "rounded-md bg-primary text-[13px] font-semibold text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--primary-foreground)_12%)] active:bg-[color-mix(in_oklch,var(--primary),var(--primary-foreground)_22%)] disabled:opacity-40"

const destructiveButton =
  "rounded-md bg-destructive text-[13px] font-semibold text-white hover:bg-[color-mix(in_oklch,var(--destructive),var(--foreground)_10%)] active:bg-[color-mix(in_oklch,var(--destructive),var(--foreground)_20%)] focus-visible:border-destructive focus-visible:ring-destructive/30 disabled:opacity-40"

const signatureButton =
  "border-0 text-foreground ring-0 hover:brightness-[0.98] [background-image:radial-gradient(ellipse_90%_85%_at_55%_60%,color-mix(in_oklch,var(--ring)_40%,var(--background)),transparent_72%),linear-gradient(160deg,color-mix(in_oklch,var(--ring)_10%,var(--background)),color-mix(in_oklch,var(--ring)_18%,var(--background))_48%,color-mix(in_oklch,var(--ring)_13%,var(--background)))] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--background)_70%,transparent),0_2px_10px_color-mix(in_oklch,var(--ring)_30%,transparent)]"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 motion-press items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: secondaryButton,
        primary: primaryButton,
        signature: signatureButton,
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive: destructiveButton,
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    compoundVariants: [
      {
        variant: ["primary", "destructive"],
        size: ["default", "sm"],
        class: "rounded-md px-3 text-[13px]",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      data-variant={variant}
    />
  )
}

export { Button, buttonVariants }
