import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { PageHeader, Toolbar } from "~components/shell"
import { Button, IconButton } from "~components/button"
import { Segmented } from "~components/choice"
import { StageIcon, type Stage } from "~components/brand"
import { cn } from "~components/cn"
import { AppFrame, RouterLink } from "~app/app-frame"
import { APPLY_TABS } from "./apply-board"

const EVENTS: Record<
  number,
  { label: string; stage: Stage; muted?: boolean }[]
> = {
  9: [{ label: "Content intern", stage: "closed", muted: true }],
  14: [{ label: "Business analyst", stage: "interview" }],
  19: [{ label: "Product analyst", stage: "interview" }],
  21: [{ label: "Marketing intern", stage: "applied" }],
  25: [
    { label: "Business analyst", stage: "interview" },
    { label: "Junior Marketing", stage: "saved" },
  ],
  30: [{ label: "UX research due", stage: "saved" }],
}

/** Month view. Events use the stage icon and a soft fill, never a solid color block. */
export default function ApplyCalendar() {
  const today = 26
  const days = Array.from({ length: 35 }, (_, i) => i - 2) // Oct 2026 starts on Thursday
  return (
    <AppFrame>
      <PageHeader title="Apply">
        <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />}>
          New job
        </Button>
      </PageHeader>
      <Toolbar tabs={APPLY_TABS} active="/apply/calendar" link={RouterLink}>
        <Segmented
          label="Range"
          value="month"
          onChange={() => {}}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </Toolbar>
      <div className="flex items-center gap-2 px-5 py-3">
        <h2 className="text-title font-semibold">October 2026</h2>
        <IconButton label="Previous month" size={24}>
          <ChevronLeft />
        </IconButton>
        <IconButton label="Next month" size={24}>
          <ChevronRight />
        </IconButton>
        <Button variant="secondary" size="sm">
          Today
        </Button>
      </div>
      <div className="text-small text-placeholder grid grid-cols-7 px-5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-1.5 pb-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-5 border-t-[0.5px] border-border px-5 pb-4">
        {days.map((d) => {
          const inMonth = d >= 1 && d <= 31
          const n = inMonth ? d : d < 1 ? 30 + d : d - 31
          return (
            <div
              key={d}
              className="flex min-h-0 flex-col gap-1 overflow-hidden border-r-[0.5px] border-b-[0.5px] border-border p-1.5"
            >
              <span
                className={cn(
                  "text-small inline-flex size-[22px] items-center justify-center rounded-full font-medium",
                  d === today
                    ? "bg-fg text-white"
                    : inMonth
                      ? "text-fg"
                      : "text-placeholder"
                )}
              >
                {n}
              </span>
              {inMonth &&
                (EVENTS[d] ?? []).map((e) => (
                  <span
                    key={e.label}
                    className={cn(
                      "bg-subtle text-small flex h-[22px] items-center gap-[5px] truncate rounded-[5px] px-1.5",
                      e.muted ? "text-fg-3" : "text-fg"
                    )}
                  >
                    <StageIcon stage={e.stage} size={12} />
                    {e.label}
                  </span>
                ))}
            </div>
          )
        })}
      </div>
    </AppFrame>
  )
}
