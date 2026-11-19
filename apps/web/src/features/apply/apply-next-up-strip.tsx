import { Calendar, Flag, Reply } from "lucide-react"
import type { JobId, JobView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { StageIcon } from "@workspace/ui/components/stage-icon"

import { nextUp, type NextUpKind } from "./apply-next-up.ts"
import { useChosenTimeZone } from "./apply-time-zone.ts"

function KindIcon({ kind }: { kind: NextUpKind }) {
  if (kind === "interview")
    return <Calendar aria-hidden className="size-3 shrink-0 text-chart-3" />
  if (kind === "deadline")
    return <Flag aria-hidden className="size-3 shrink-0 text-chart-4" />
  if (kind === "offer") return <StageIcon stage="offer" size={12} />
  return <Reply aria-hidden className="size-3 shrink-0 text-muted-foreground" />
}

export function ApplyNextUp({
  jobs,
  onOpen,
}: {
  jobs: readonly JobView[]
  onOpen: (jobId: JobId) => void
}) {
  const zone = useChosenTimeZone()
  const items = nextUp(jobs, new Date(), zone)
  if (items.length === 0) return null
  return (
    <section
      aria-label="Next up"
      data-slot="next-up"
      className="flex shrink-0 items-center gap-2 overflow-x-auto bg-background px-3 pt-2.5 motion-fade-in"
    >
      <span className="shrink-0 pr-0.5 pl-1 text-xs text-muted-foreground">
        Next up
      </span>
      {items.map((item) => (
        <Button
          key={`${item.kind}-${item.jobId}`}
          type="button"
          variant="outline"
          data-slot="next-up-item"
          className="h-11 shrink-0 gap-1.5 rounded-[6px] border-foreground/8 bg-card px-2.5 text-[12.5px] font-normal whitespace-nowrap hover:border-foreground/16 hover:bg-card md:h-7"
          onClick={() => onOpen(item.jobId)}
        >
          <KindIcon kind={item.kind} />
          <span className="font-medium">{item.company}</span>
          <span className="text-muted-foreground">{item.label}</span>
        </Button>
      ))}
    </section>
  )
}
