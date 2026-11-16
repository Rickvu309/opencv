import { useLayoutEffect, useReducer, type ComponentType } from "react"

import { useMediaQuery } from "@/lib/use-media-query.ts"

import {
  LANDING_FIGURE_LABELS,
  LANDING_PHONE_SCENE_LABELS,
  type LandingFigureId,
  type LandingPhoneSceneId,
} from "../landing-copy.ts"
import { ApplyBoardAnimated } from "./oc/apply-board.tsx"
import { ApplyJobAnimated } from "./oc/apply-job.tsx"
import { CoachChatAnimated } from "./oc/coach-chat.tsx"
import { PaperEditorAnimated } from "./oc/paper-editor.tsx"
import { PitchPageAnimated } from "./oc/pitch-page.tsx"
import { ProofPageAnimated } from "./oc/proof-page.tsx"
import { ApplyBoardScene } from "./phone/apply-board-scene.tsx"
import { ApplyScene } from "./phone/apply-scene.tsx"
import { CoachScene } from "./phone/coach-scene.tsx"
import { PaperScene } from "./phone/paper-scene.tsx"
import { useLandingFonts } from "./phone/use-landing-fonts.ts"
import { useOnScreen } from "./use-on-screen.ts"
import "./landing-figure.css"

const FRAME_WIDTH = 1600

const PHONE_COLUMN = "(max-width: 39.99rem)"

const FIGURES = {
  "apply-board": ApplyBoardAnimated,
  paper: PaperEditorAnimated,
  apply: ApplyJobAnimated,
  coach: CoachChatAnimated,
  proof: ProofPageAnimated,
  pitch: PitchPageAnimated,
} satisfies Record<LandingFigureId, ComponentType>

const PHONE_SCENES = {
  "apply-board": ApplyBoardScene,
  paper: PaperScene,
  apply: ApplyScene,
  coach: CoachScene,
} satisfies Record<LandingPhoneSceneId, ComponentType>

function phoneSceneId(id: LandingFigureId): LandingPhoneSceneId | null {
  return id in PHONE_SCENES ? (id as LandingPhoneSceneId) : null
}

export function LandingFigure({ id }: { id: LandingFigureId }) {
  const phone = useMediaQuery(PHONE_COLUMN, false)
  const sceneId = phoneSceneId(id)
  if (phone && sceneId) return <PhoneScene id={sceneId} />
  return <DesktopFigure id={id} />
}

function PhoneScene({ id }: { id: LandingPhoneSceneId }) {
  const Scene = PHONE_SCENES[id]
  const fontsLoaded = useLandingFonts()
  return (
    <div
      role="img"
      aria-label={LANDING_PHONE_SCENE_LABELS[id]}
      data-loading={fontsLoaded ? undefined : ""}
      className="landing-phone-scene"
    >
      <div aria-hidden="true">{fontsLoaded && <Scene />}</div>
    </div>
  )
}

function DesktopFigure({ id }: { id: LandingFigureId }) {
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
