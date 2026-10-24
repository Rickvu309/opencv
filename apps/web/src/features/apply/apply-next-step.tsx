import { lazy, Suspense, useState } from "react"

import { nextSteps, type NextStep } from "@/features/apply/apply-next-step.ts"
import type {
  ApplyCard,
  StageId,
  TrackKind,
} from "@/features/apply/apply-types.ts"

const SmartRecommendation = lazy(() =>
  import("@workspace/ui/components/smart-recommendation").then((m) => ({
    default: m.SmartRecommendation,
  }))
)

type Props = {
  card: ApplyCard
  onMove: (stage: StageId) => void
  onTrack: (trackKind: TrackKind) => void
}

type Before = { stage: StageId; trackKind: TrackKind }

/**
 * The suggestion stays frozen at the Stage it was shown for, so accepting a
 * move does not swap in the next suggestion before Undo can be used.
 */
export function ApplyNextStep({ card, onMove, onTrack }: Props) {
  const [before, setBefore] = useState<Before | null>(null)
  return (
    <NextStepCard
      key={`${card.id}:${before?.stage ?? card.stage}`}
      card={card}
      onAccept={(step) => {
        setBefore({ stage: card.stage, trackKind: card.trackKind })
        if (step.stage) onMove(step.stage)
        if (step.trackKind) onTrack(step.trackKind)
      }}
      onUndo={(step) => {
        if (before && step.stage) onMove(before.stage)
        if (before && step.trackKind) onTrack(before.trackKind)
        setBefore(null)
      }}
    />
  )
}

function NextStepCard({
  card,
  onAccept,
  onUndo,
}: {
  card: ApplyCard
  onAccept: (step: NextStep) => void
  onUndo: (step: NextStep) => void
}) {
  const [steps] = useState(() => nextSteps(card))
  if (steps.length === 0) return null
  return (
    <Suspense fallback={null}>
      <SmartRecommendation
        title="Next step"
        options={steps}
        onAccept={(step) => onAccept(step as NextStep)}
        onUndo={(step) => onUndo(step as NextStep)}
      />
    </Suspense>
  )
}
