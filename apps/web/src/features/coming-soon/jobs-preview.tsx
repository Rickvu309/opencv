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
    <div aria-hidden="true" className="flex flex-col gap-2.5 p-4">
      <div className="flex h-11 items-center gap-2.5 rounded-[12px] border border-border bg-background px-3.5">
        <Search className="size-[15px] text-muted-foreground" />
        <span className="text-sm text-foreground">Marketing, Hanoi</span>
        <span className="ml-auto hidden gap-1.5 sm:flex">
          {["Junior", "Full-time", "Hybrid", "Salary"].map((filter) => (
            <span
              key={filter}
              className="inline-flex h-[26px] items-center rounded-[13px] border border-border px-2.5 text-xs text-muted-foreground"
            >
              {filter}
            </span>
          ))}
        </span>
      </div>
      {ROWS.map((row) => (
        <div
          key={row.title}
          className="flex h-[72px] items-center gap-3.5 rounded-[12px] border border-border bg-background px-4"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted text-sm text-muted-foreground">
            {row.initials}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14.5px] font-semibold text-foreground">
              {row.title}
            </span>
            <span className="truncate text-[12.5px] text-muted-foreground">
              {row.company}
            </span>
          </span>
          <span className="inline-flex h-6 shrink-0 items-center rounded-[12px] bg-muted px-[9px] text-xs font-medium text-muted-foreground">
            {row.fit}
          </span>
        </div>
      ))}
    </div>
  )
}
