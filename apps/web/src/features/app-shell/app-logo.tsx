import { brandName } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

type MarkProps = {
  className?: string
}

function OpenCvMark({ className }: MarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0 text-foreground", className)}
      aria-hidden="true"
    >
      <rect
        x="3.2"
        y="3.2"
        width="17.6"
        height="17.6"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path d="M2 8A14 14 0 0 1 16 22H2Z" fill="currentColor" />
    </svg>
  )
}

type Props = {
  className?: string
  withWordmark?: boolean
  size?: "sm" | "md" | "lg"
}

const SIZES = {
  sm: { box: "size-5", text: "text-sm" },
  md: { box: "size-6", text: "text-base" },
  lg: { box: "size-8", text: "text-xl" },
} as const

export function OpenCvLogo({
  className,
  withWordmark = false,
  size = "md",
}: Props) {
  const s = SIZES[size]
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <OpenCvMark className={s.box} />
      {withWordmark ? (
        <span
          className={cn(
            "font-semibold tracking-[-0.035em] text-foreground lowercase",
            s.text
          )}
        >
          {brandName}
        </span>
      ) : (
        <span className="sr-only">{brandName}</span>
      )}
    </span>
  )
}
