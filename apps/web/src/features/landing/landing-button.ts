import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const TONE = {
  primary: buttonVariants({ variant: "signature" }),
  quiet: cn(
    buttonVariants({ variant: "ghost" }),
    "border-0 bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] text-foreground shadow-none ring-0 hover:bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)]"
  ),
} as const

const SIZE = {
  nav: "h-8 pointer-coarse:h-11 rounded-full px-3 py-0 text-[13px] font-medium",
  close: "h-11 rounded-full px-5 py-0 text-base font-medium",
} as const

export function landingButton(options: {
  tone: keyof typeof TONE
  size: keyof typeof SIZE
}) {
  return cn(TONE[options.tone], SIZE[options.size])
}

const PILL =
  "w-full rounded-full border-0 px-3 text-[15px] font-medium text-foreground"

const PLAN = {
  neutral: cn(
    buttonVariants({ variant: "ghost" }),
    PILL,
    "bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] shadow-none ring-1 ring-[color-mix(in_oklch,var(--foreground)_8%,transparent)] ring-inset hover:bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)]"
  ),
  white: cn(
    buttonVariants({ variant: "ghost" }),
    PILL,
    "bg-card shadow-[0_2px_10px_color-mix(in_oklch,var(--ring)_30%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--card)_70%,transparent)] ring-inset hover:brightness-[0.98]"
  ),
} as const

export function landingPlanButton(tone: keyof typeof PLAN) {
  return PLAN[tone]
}
