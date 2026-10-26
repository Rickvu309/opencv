const ROWS = [
  {
    initials: "LC",
    title: "Marketing Executive",
    company: "Lumière Cosmetics, Ho Chi Minh City",
  },
  { initials: "AG", title: "Content Specialist", company: "Agency, Hanoi" },
  {
    initials: "SH",
    title: "Social Media Executive",
    company: "Shopee partner, Remote",
  },
  { initials: "FA", title: "Growth Marketer", company: "Fintech app, Remote" },
] as const

export function JobsPreview() {
  return (
    <div aria-hidden="true" className="flex flex-col">
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
        </div>
      ))}
    </div>
  )
}
