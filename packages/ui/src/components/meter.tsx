import { cn } from "cn"

function percent(value: number) {
  return Math.round(Math.min(1, Math.max(0, value)) * 100)
}

function tone(pct: number) {
  if (pct >= 100) return "bg-destructive"
  if (pct >= 80) return "bg-chart-4"
  return "bg-foreground"
}

function Meter({
  label,
  value,
  caption,
  className,
}: {
  label: string
  value: number
  caption?: string
  className?: string
}) {
  const pct = percent(value)
  return (
    <div data-slot="meter" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span
          className={pct >= 100 ? "text-destructive" : "text-muted-foreground"}
        >
          {caption ?? (pct >= 100 ? "Limit reached" : `${pct}% used`)}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full bg-muted"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full", tone(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export { Meter }
