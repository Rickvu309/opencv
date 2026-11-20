import { Search } from "lucide-react"

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
    <div
      aria-hidden="true"
      data-slot="jobs-preview"
      className="flex min-w-0 flex-col gap-2.5 p-4"
    >
      <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-2.5 rounded-lg border border-border bg-background px-3.5 py-2">
        <Search className="size-[15px] shrink-0 text-muted-foreground" />
        <span className="min-w-0 text-[13.5px] break-words text-foreground/[.62]">
          Marketing, Hanoi
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {["Junior", "Full-time", "Hybrid", "Salary"].map((filter) => (
          <span
            key={filter}
            className="inline-flex min-h-[26px] items-center rounded-xl border border-border px-2.5 text-xs break-words text-muted-foreground"
          >
            {filter}
          </span>
        ))}
      </div>
      {ROWS.map((row) => (
        <div
          key={row.title}
          className="flex min-h-[72px] min-w-0 items-center gap-3.5 rounded-lg border border-border bg-background px-4 py-3"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground/85">
            {row.initials}
          </span>
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span className="text-[14.5px] font-semibold break-words text-foreground">
              {row.title}
            </span>
            <span className="text-xs break-words text-foreground/[.62]">
              {row.company}
            </span>
            <span className="mt-1.5 inline-flex h-6 items-center rounded-lg bg-muted px-[9px] text-xs font-semibold text-foreground/90">
              {row.fit}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
