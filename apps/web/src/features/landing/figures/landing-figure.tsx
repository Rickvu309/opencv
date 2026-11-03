import { useLayoutEffect, useReducer, type ComponentType } from "react"

import { LANDING_FIGURE_LABELS, type LandingFigureId } from "../landing-copy.ts"
import { ApplyBoardAnimated } from "./oc/apply-board.tsx"
import { ApplyJobAnimated } from "./oc/apply-job.tsx"
import { CoachChatAnimated } from "./oc/coach-chat.tsx"
import { PaperEditorAnimated } from "./oc/paper-editor.tsx"
import { PitchPageAnimated } from "./oc/pitch-page.tsx"
import { ProofPageAnimated } from "./oc/proof-page.tsx"
import { useOnScreen } from "./use-on-screen.ts"
import "./landing-figure.css"

const FRAME_WIDTH = 1600

const FIGURES = {
  "apply-board": ApplyBoardAnimated,
  paper: PaperEditorAnimated,
  apply: ApplyJobAnimated,
  coach: CoachChatAnimated,
  proof: ProofPageAnimated,
  pitch: PitchPageAnimated,
} satisfies Record<LandingFigureId, ComponentType>

export function LandingFigure({ id }: { id: LandingFigureId }) {
  const Figure = FIGURES[id]
  const [ref, onScreen] = useOnScreen<HTMLDivElement>()
  const [scale, measured] = useReducer(
    (_: number, width: number) => width / FRAME_WIDTH,
    0
  )

  useLayoutEffect(() => {
    const frame = ref.current
    if (!frame) return
    const measure = () => measured(frame.clientWidth)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [ref])

  return (
    <div
      ref={ref}
      role="img"
      aria-label={LANDING_FIGURE_LABELS[id]}
      data-paused={onScreen ? undefined : ""}
      className="landing-screen landing-figure"
    >
      <div
        aria-hidden="true"
        className="landing-figure-stage"
        style={{ transform: `scale(${scale})` }}
      >
        <Figure />
      </div>
    </div>
  )
}
