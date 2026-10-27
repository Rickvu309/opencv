const BARS = [
  { value: "142k", height: "h-12" },
  { value: "118k", height: "h-16" },
  { value: "205k", height: "h-20" },
] as const

export function ProofPreview() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 px-6 py-5">
      <div className="flex items-end gap-3">
        {BARS.map((bar) => (
          <div key={bar.value} className="flex flex-1 flex-col gap-2">
            <div className={`rounded-md bg-muted ${bar.height}`} />
            <span className="text-xs text-muted-foreground">{bar.value}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-foreground">+38%</p>
      <p className="text-xs text-muted-foreground">followers</p>
      <p className="text-sm text-foreground">
        Grew followers by 38% in four months.
      </p>
      <p className="text-xs text-muted-foreground">NA</p>
      <p className="text-sm text-foreground">Manager confirmed</p>
    </div>
  )
}
