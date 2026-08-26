import { useEffect, useState } from "react"
import { Star } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import type { ApplyStage } from "@workspace/domain"
import { cn } from "@workspace/ui/lib/utils"

import {
  companyShort,
  formatTrackDate,
  STAGES,
  trackKindLabel,
} from "@/features/apply/apply-types.ts"
import type { MoveCardFixture } from "@/features/coach-receipt-prototypes/fixtures.ts"
import { ReceiptFrame } from "@/features/coach-receipt-prototypes/receipt-frame.tsx"

function stageLabel(stage: ApplyStage) {
  return STAGES.find((item) => item.id === stage)?.label ?? stage
}

function MiniCard({ fixture }: { fixture: MoveCardFixture }) {
  return (
    <div className="w-[11.5rem] rounded-xl border border-border bg-card p-2.5 text-left shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 text-xs leading-snug font-semibold text-foreground">
          {fixture.title}
        </p>
        {fixture.starred ? (
          <Star
            className="size-3 shrink-0 fill-foreground/20 text-foreground/50"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="flex size-4 items-center justify-center rounded bg-muted text-[8px] font-bold tracking-tight">
          {companyShort(fixture.company)}
        </span>
        <span className="truncate text-[11px]">{fixture.company}</span>
      </div>
      <p className="mt-1.5 text-[10px]">
        {formatTrackDate(fixture.trackDate)} ·{" "}
        {trackKindLabel(fixture.trackKind)}
      </p>
    </div>
  )
}

export function MoveCardReceipt({
  fixture,
  ok,
  errorSummary,
  onOpen,
}: {
  fixture: MoveCardFixture
  ok: boolean
  errorSummary?: string
  onOpen?: () => void
}) {
  const [replay, setReplay] = useState(0)
  const [shown, setShown] = useState<ApplyStage>(fixture.from)

  useEffect(() => {
    setShown(fixture.from)
    const timer = window.setTimeout(() => setShown(fixture.to), 80)
    return () => window.clearTimeout(timer)
  }, [fixture.from, fixture.to, replay])

  const fromLabel = stageLabel(fixture.from)
  const toLabel = stageLabel(fixture.to)
  const sameStage = fixture.from === fixture.to

  return (
    <ReceiptFrame
      ok={ok}
      headline={
        ok
          ? sameStage
            ? `${fixture.title} at ${fixture.company} is already in ${toLabel}`
            : `Moved ${fixture.title} at ${fixture.company} from ${fromLabel} to ${toLabel}`
          : (errorSummary ?? fixture.summary)
      }
      reversal={ok ? fixture.reversal : undefined}
    >
      <div className="ml-5 space-y-2">
        <div
          className="grid grid-cols-5 gap-1"
          aria-label={`Board Stages, card now in ${stageLabel(shown)}`}
        >
          {STAGES.map((stage) => {
            const here = shown === stage.id
            const involved =
              stage.id === fixture.from || stage.id === fixture.to
            return (
              <div key={stage.id} className="min-w-0">
                <div className="mb-1 flex items-center gap-1">
                  <span className={cn("size-1.5 rounded-full", stage.dot)} />
                  <span
                    className={cn(
                      "truncate text-[10px]",
                      involved
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex min-h-16 items-start justify-center rounded-lg border border-dashed px-0.5 py-1",
                    here ? "border-foreground/20 bg-muted/50" : "border-border"
                  )}
                >
                  {here ? (
                    <div className="origin-top scale-[0.92] transition-all duration-300">
                      <MiniCard fixture={fixture} />
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setReplay((value) => value + 1)}
          >
            Replay move
          </Button>
          {onOpen ? (
            <Button type="button" variant="outline" size="xs" onClick={onOpen}>
              Open on Apply
            </Button>
          ) : null}
        </div>
      </div>
    </ReceiptFrame>
  )
}
