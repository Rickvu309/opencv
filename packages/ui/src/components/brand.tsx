import { cn } from "cn"

function Mark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-slot="mark"
      className={cn("shrink-0", className)}
    >
      <rect
        x="3.2"
        y="3.2"
        width="17.6"
        height="17.6"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path d="M2 22H16A14 14 0 0 0 2 8Z" fill="currentColor" />
    </svg>
  )
}

function Brand({
  lead,
  size = 13,
  markSize = Math.round(size * 0.92),
  gap = Math.round(size * 0.28),
  letterSpacing = -size * 0.03,
  className,
}: {
  lead?: string
  size?: number
  markSize?: number
  gap?: number
  letterSpacing?: number
  className?: string
}) {
  return (
    <span
      data-slot="brand"
      className={cn(
        "inline-flex flex-wrap items-center justify-center font-semibold",
        className
      )}
      style={{ fontSize: size, gap, letterSpacing: `${letterSpacing}px` }}
    >
      {lead ? <span className="whitespace-nowrap">{lead}</span> : null}
      <span className="inline-flex items-center" style={{ gap }}>
        <Mark size={markSize} />
        <span>opencv</span>
      </span>
    </span>
  )
}

export { Brand, Mark }
