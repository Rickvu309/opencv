import { Button } from "@workspace/ui/components/button"

import { changesLine, coachCopy } from "./coach-copy.ts"
import type { CoachUiPart } from "./coach-model.ts"

type ResultPart = Extract<CoachUiPart, { kind: "result" }>

type Props = {
  part: ResultPart
  glowOpen: boolean
  onOpen: () => void
  onUndo: () => void
}

export function CoachResultCard({ part, glowOpen, onOpen, onUndo }: Props) {
  const changes =
    part.changes ??
    (part.summary.match(/(\d+)\s+changes/)?.[1]
      ? Number(part.summary.match(/(\d+)\s+changes/)?.[1])
      : undefined)

  return (
    <div
      data-slot="coach-result-card"
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
        CV
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{part.name}</div>
        {changes != null ? (
          <div className="text-sm text-muted-foreground">
            {changesLine(changes)}
          </div>
        ) : part.summary ? (
          <div className="text-sm text-muted-foreground">{part.summary}</div>
        ) : null}
        {part.undone ? (
          <div className="text-sm text-muted-foreground">
            {coachCopy.undone}
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant={glowOpen ? "default" : "outline"}
        size="sm"
        onClick={onOpen}
      >
        {coachCopy.open}
      </Button>
      {part.activityId && !part.undone ? (
        <Button type="button" variant="outline" size="sm" onClick={onUndo}>
          {coachCopy.undo}
        </Button>
      ) : null}
    </div>
  )
}
