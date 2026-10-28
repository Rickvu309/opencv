const BARS = [
  { value: "142k", height: "h-8" },
  { value: "118k", height: "h-10" },
  { value: "205k", height: "h-12" },
] as const

export function ProofPreview() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 px-6 py-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex h-20 items-end gap-2">
            {BARS.map((bar) => (
              <div
                key={bar.value}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div className={`w-full rounded-md bg-muted ${bar.height}`} />
                <span className="text-xs text-muted-foreground">
                  {bar.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-xl font-semibold">+38%</span>
            <span className="text-xs text-muted-foreground">followers</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Grew followers by 38% in four months.
          </p>
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-border bg-background p-4">
          <div className="flex h-20 items-end gap-1">
            {["h-8", "h-10", "h-12", "h-10", "h-14", "h-16", "h-14"].map(
              (height, index) => (
                <span
                  key={index}
                  className={`flex-1 rounded-sm bg-muted ${height}`}
                />
              )
            )}
          </div>
          <p className="mt-3 text-sm font-medium">52% open rate</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          NA
        </span>
        <div>
          <p className="text-sm font-medium">Manager confirmed</p>
        </div>
      </div>
    </div>
  )
}
