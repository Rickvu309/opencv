import { brandName } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

type MarkProps = {
  className?: string
}

/** Icon only: open C arc with center dot */
export function OpenPathMark({ className }: MarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0 text-foreground", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" opacity="0.1" />
      <path
        d="M16 7.5a8.5 8.5 0 1 0 6.8 13.6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
    </svg>
  )
}

type Props = {
  className?: string
  withWordmark?: boolean
  size?: "sm" | "md" | "lg"
}

const SIZES = {
  sm: { box: "size-7", text: "text-sm" },
  md: { box: "size-8", text: "text-base" },
  lg: { box: "size-12", text: "text-xl" },
} as const

export function OpenPathLogo({
  className,
  withWordmark = false,
  size = "md",
}: Props) {
  const s = SIZES[size]
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <OpenPathMark className={s.box} />
      {withWordmark ? (
        <span
          className={cn("font-semibold tracking-tight text-foreground", s.text)}
        >
          {brandName}
        </span>
      ) : (
        <span className="sr-only">{brandName}</span>
      )}
    </span>
  )
}
