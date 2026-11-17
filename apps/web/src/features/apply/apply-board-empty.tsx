import { FunnelX, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"
import { Kbd } from "@workspace/ui/components/kbd"

const COINS = [
  { x: 0, y: 0 },
  { x: 54, y: 0 },
  { x: 0, y: 54 },
  { x: 54, y: 54 },
]

function StageCoins() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="size-[96px]">
      <g
        fill="var(--card)"
        stroke="var(--muted-foreground)"
        strokeOpacity={0.55}
        strokeWidth={1.2}
      >
        {COINS.flatMap(({ x, y }) => [
          <ellipse
            key={`${x}-${y}-edge`}
            cx={x + 21}
            cy={y + 24}
            rx={20}
            ry={17}
          />,
          <ellipse
            key={`${x}-${y}-top`}
            cx={x + 21}
            cy={y + 19}
            rx={20}
            ry={17}
          />,
        ])}
      </g>
      <g fill="none" stroke="var(--foreground)" strokeWidth={1.6}>
        <ellipse cx={21} cy={19} rx={11.5} ry={9.5} />
        <ellipse cx={75} cy={19} rx={11.5} ry={9.5} />
        <ellipse cx={21} cy={73} rx={11.5} ry={9.5} />
      </g>
      <path d="M75 11.5a8 6.5 0 0 0 0 15z" fill="var(--foreground)" />
      <path d="M21 73v-7.5a8 6.5 0 1 0 8 7.5z" fill="var(--foreground)" />
      <ellipse cx={75} cy={73} rx={11.5} ry={9.5} fill="var(--foreground)" />
      <path
        d="m70 73 3.5 3.2L80 69.6"
        fill="none"
        stroke="var(--card)"
        strokeWidth={1.8}
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
    <Empty className="min-h-0 gap-0 rounded-none border-0 bg-background p-0 pb-20 text-start">
      <div className="flex flex-col items-start">
        <StageCoins />
        <h2 className="mt-6 text-[15px] font-semibold">Track your first job</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Add the jobs you're applying to.
        </p>
        <p className="mt-3 max-w-[300px] text-[13px] leading-[1.55] text-muted-foreground">
          Paste a posting link and the role, company and location fill in for
          you.
        </p>
        <Button
          type="button"
          variant={dialogOpen ? "ghost" : "primary"}
          aria-label="Add job"
          aria-keyshortcuts="N"
          className="mt-5 h-11 gap-2 rounded-md pr-2 pl-3 text-[13px] font-semibold md:h-8"
          onClick={onAdd}
        >
          <span>Add job</span>
          <Kbd className="h-[18px] min-w-0 rounded-[4px] bg-foreground/6 px-[5px] text-[11px] font-normal text-foreground/62 group-data-[variant=primary]/button:bg-primary-foreground/15 group-data-[variant=primary]/button:text-primary-foreground/75">
            N
          </Kbd>
        </Button>
      </div>
    </Empty>
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
        className="mt-4 h-11 gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-normal md:h-[30px]"
        onClick={onClear}
      >
        <X className="size-[13px] text-muted-foreground" />
        Clear filters
      </Button>
    </div>
  )
}
