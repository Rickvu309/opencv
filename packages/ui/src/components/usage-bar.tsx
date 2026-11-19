import { cn } from "cn"

function UsageBar({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  const tone =
    pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-chart-4" : "bg-foreground"
  return (
    <div
      data-slot="usage-bar"
      className={cn("h-1.5 rounded-full bg-border", className)}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { UsageBar }
