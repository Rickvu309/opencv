import { FunnelX, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"

function StageCoins() {
  return (
    <svg viewBox="0 0 92 92" aria-hidden="true" className="size-[92px]">
      <g fill="var(--card)" stroke="var(--foreground)" strokeWidth={1.2}>
        {[0, 50].flatMap((y) =>
          [0, 50].flatMap((x) => [
            <ellipse
              key={`${x}-${y}-edge`}
              cx={x + 20}
              cy={y + 23}
              rx={20}
              ry={18}
            />,
            <ellipse
              key={`${x}-${y}-top`}
              cx={x + 20}
              cy={y + 18}
              rx={20}
              ry={18}
            />,
          ])
        )}
        <ellipse cx={20} cy={18} rx={12} ry={10} />
        <ellipse cx={70} cy={18} rx={12} ry={10} />
        <ellipse cx={20} cy={68} rx={12} ry={10} />
        <ellipse cx={70} cy={68} rx={12} ry={10} fill="var(--foreground)" />
      </g>
      <path d="M70 8a12 10 0 0 0 0 20z" fill="var(--foreground)" />
      <path d="M20 68l0-10a12 10 0 1 0 12 10z" fill="var(--foreground)" />
      <path
        d="M20 6 9 17l-5-5"
        transform="translate(64 62) scale(0.5)"
        fill="none"
        stroke="var(--card)"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ApplyEmpty({
  dialogOpen,
  onAdd,
}: {
  dialogOpen: boolean
  onAdd: () => void
}) {
  return (
    <div
      data-slot="apply-empty"
      className="flex min-h-0 flex-1 flex-col items-center justify-center bg-background pb-20"
    >
      <StageCoins />
      <h2 className="mt-7 text-[15px] font-semibold">Track your first job</h2>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Add the jobs you're applying to.
      </p>
      <Button
        type="button"
        variant={dialogOpen ? "ghost" : "glow"}
        aria-label="Add job"
        aria-keyshortcuts="N"
        className="mt-5 h-8 gap-2 rounded-md pr-2 pl-3 text-[13px] font-semibold"
        onClick={onAdd}
      >
        <span>Add job</span>
        <Kbd className="h-[18px] min-w-0 rounded-[4px] bg-foreground/6 px-[5px] text-[11px] font-normal text-foreground/50">
          N
        </Kbd>
      </Button>
    </div>
  )
}

export function ApplyNoResults({ onClear }: { onClear: () => void }) {
  return (
    <div
      data-slot="apply-no-results"
      className="flex min-h-0 flex-1 flex-col items-center justify-center bg-card pb-[120px]"
    >
      <FunnelX className="size-11 rounded-xl border border-border bg-card p-3 text-muted-foreground shadow-[0_2px_6px_rgb(0_0_0/0.04)]" />
      <h2 className="mt-3.5 text-[15px] font-semibold">
        No jobs match these filters
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Try removing one.
      </p>
      <Button
        type="button"
        variant="ghost"
        className="mt-4 h-[30px] gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-normal"
        onClick={onClear}
      >
        <X className="size-[13px] text-muted-foreground" />
        Clear filters
      </Button>
    </div>
  )
}
