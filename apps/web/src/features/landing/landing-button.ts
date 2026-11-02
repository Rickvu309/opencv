import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Marketing calls to action. Values are the pen Open app / Prefooter buttons:
 * one mesh fill, one quiet fill, two sizes. Plan pills stay in this file so
 * the landing feature has one buttonVariants call: a 4% neutral fill and a
 * white fill. Height comes from the pricing snapshot on the anchor.
 */
const MESH =
  "[background-image:radial-gradient(ellipse_90%_85%_at_55%_60%,color-mix(in_oklch,var(--ring)_40%,var(--background)),transparent_72%),linear-gradient(160deg,color-mix(in_oklch,var(--ring)_10%,var(--background)),color-mix(in_oklch,var(--ring)_18%,var(--background))_48%,color-mix(in_oklch,var(--ring)_13%,var(--background)))]"

const TONE = {
  primary: cn(
    "border-0 text-foreground ring-0 hover:brightness-[0.98]",
    MESH,
    "shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--background)_70%,transparent),0_2px_10px_color-mix(in_oklch,var(--ring)_30%,transparent)]"
  ),
  quiet:
    "border-0 text-foreground ring-0 shadow-none bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] hover:bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)]",
} as const

const SIZE = {
  nav: "h-8 pointer-coarse:h-11 rounded-full px-3 py-0 text-[13px] font-medium",
  close: "h-11 rounded-full px-5 py-0 text-base font-medium",
} as const

export function landingButton(options: {
  tone: keyof typeof TONE
  size: keyof typeof SIZE
}) {
  return cn(
    buttonVariants({ variant: "ghost" }),
    TONE[options.tone],
    SIZE[options.size]
  )
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
