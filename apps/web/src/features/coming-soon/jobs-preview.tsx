const ROWS = [
  {
    initials: "LC",
    title: "Marketing Executive",
    company: "Lumière Cosmetics, Ho Chi Minh City",
    fit: "82% fit",
  },
  {
    initials: "AG",
    title: "Content Specialist",
    company: "Agency, Hanoi",
    fit: "77% fit",
  },
  {
    initials: "SH",
    title: "Social Media Executive",
    company: "Shopee partner, Remote",
    fit: "70% fit",
  },
  {
    initials: "FA",
    title: "Growth Marketer",
    company: "Fintech app, Remote",
    fit: "66% fit",
  },
] as const

export function JobsPreview() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      <div className="flex flex-wrap gap-2 border-b border-border px-5 py-4">
        {["Marketing, Hanoi", "Junior", "Full-time", "Hybrid", "Salary"].map(
          (filter) => (
            <span
              key={filter}
              className="inline-flex h-7 items-center rounded-full border border-border px-3 text-xs text-muted-foreground"
            >
              {filter}
            </span>
          )
        )}
      </div>
      {ROWS.map((row) => (
        <div
          key={row.title}
          className="flex items-center gap-3 border-b border-border px-5 py-3.5"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
            {row.initials}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {row.title}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.company}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {row.fit}
          </span>
        </div>
      ))}
    </div>
  )
}
