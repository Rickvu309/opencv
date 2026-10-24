import { DISPATCH_BAYS, PLOTTER_LIFT, PLOTTER_STOPS } from "./layout.ts"

export const PROOF_ORDER = ["context", "action", "outcome"] as const
export const DISPATCH_STAGES = [
  "Inbox",
  "Prep",
  "Sent",
  "Live",
  "Closed",
] as const

export type ProofKey = (typeof PROOF_ORDER)[number]
export type ProofLinks = Record<ProofKey, number>
export type PlotterStop = 0 | 1 | 2
export type DispatchStage = 0 | 1 | 2 | 3 | 4
export type FigureId = "proof" | "plotter" | "dispatch"

export type MotionSpec = {
  id: FigureId
  min: number
  max: number
  step: number
}

export const PROOF_SPEC: MotionSpec = { id: "proof", min: 0, max: 3, step: 1 }
export const PLOTTER_SPEC: MotionSpec = {
  id: "plotter",
  min: 0,
  max: 2,
  step: 1,
}
export const DISPATCH_SPEC: MotionSpec = {
  id: "dispatch",
  min: 0,
  max: 4,
  step: 1,
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function proofReadout(links: ProofLinks): string {
  const open = PROOF_ORDER.find((key) => links[key] < 1)
  if (!open) return "stamped · context, action, outcome"
  return `held · ${open} open`
}

export function proofPose(value: number): {
  links: ProofLinks
  pins: readonly [number, number, number]
  platen: number
  readout: string
} {
  const context = clamp(value, 0, 1)
  const action = clamp(value - 1, 0, 1)
  const outcome = clamp(value - 2, 0, 1)
  const links = { context, action, outcome }
  return {
    links,
    pins: [context, action, outcome],
    platen: Math.min(context, action, outcome),
    readout: proofReadout(links),
  }
}

export function plotterReadout(stop: PlotterStop): string {
  if (stop === 0) return "CV · your line"
  if (stop === 1) return "CV · coach line"
  return "Letter · that line"
}

export function plotterLiveReadout(value: number): string {
  if (value < 0.12) return plotterReadout(0)
  if (Math.abs(value - 1) < 0.12) return plotterReadout(1)
  if (value > 1.88) return plotterReadout(2)
  if (value < 1) return "CV · between your line and the coach line"
  return "carrying that line to the Letter"
}

export function plotterPose(value: number): {
  x: number
  y: number
  z: number
  user: number
  coach: number
  letter: number
  sheet: 0 | 1
  readout: string
} {
  const t = clamp(value, 0, 2)
  const index = Math.min(1, Math.floor(t))
  const fraction = t - index
  const from = PLOTTER_STOPS[index]
  const to = PLOTTER_STOPS[index + 1]
  const origin = PLOTTER_STOPS[0]
  const mix = clamp(Math.min(t, 1), 0, 1)
  if (!from || !to || !origin) {
    return {
      x: 0,
      y: 0,
      z: 0,
      user: 1,
      coach: 0.35,
      letter: 0.28,
      sheet: 0,
      readout: plotterReadout(0),
    }
  }
  return {
    x: from.x + (to.x - from.x) * fraction - origin.x,
    y: from.y + (to.y - from.y) * fraction - origin.y,
    z: Math.sin(fraction * Math.PI) * PLOTTER_LIFT,
    user: 1 - 0.65 * mix,
    coach: 0.35 + 0.65 * mix,
    letter: t <= 1 ? 0.28 : 0.28 + 0.72 * clamp(t - 1, 0, 1),
    sheet: t < 1.5 ? 0 : 1,
    readout: plotterLiveReadout(t),
  }
}

export function dispatchReadout(stage: DispatchStage): string {
  const name = DISPATCH_STAGES[stage]
  if (name === "Sent") return "Sent · marked sent, not mailed"
  return `${name} · on your board`
}

export function dispatchLiveReadout(value: number): string {
  const stage = asStage(value)
  if (Math.abs(value - stage) > 0.08) return "moving · still on the board"
  return dispatchReadout(stage)
}

export function asStage(value: number): DispatchStage {
  const rounded = Math.round(clamp(value, 0, 4))
  if (rounded === 1 || rounded === 2 || rounded === 3 || rounded === 4)
    return rounded
  return 0
}

export function previousStage(stage: DispatchStage): DispatchStage | null {
  if (stage === 0) return null
  if (stage === 1) return 0
  if (stage === 2) return 1
  if (stage === 3) return 2
  return 3
}

export function dispatchPose(value: number): {
  x: number
  stage: DispatchStage
  readout: string
} {
  const t = clamp(value, 0, 4)
  const index = Math.min(3, Math.floor(t))
  const from = DISPATCH_BAYS[index]
  const to = DISPATCH_BAYS[index + 1]
  const home = DISPATCH_BAYS[0]
  const stage = asStage(t)
  if (from === undefined || to === undefined || home === undefined) {
    return { x: 0, stage: 0, readout: dispatchReadout(0) }
  }
  return {
    x: from + (to - from) * (t - index) - home,
    stage,
    readout: dispatchLiveReadout(t),
  }
}

export function applyKey(
  value: number,
  key: string,
  spec: MotionSpec,
  shift: boolean
): number | null {
  const span = shift && spec.max > 2 ? spec.step * 2 : spec.step
  if (key === "ArrowRight" || key === "ArrowUp")
    return clamp(value + span, spec.min, spec.max)
  if (key === "ArrowLeft" || key === "ArrowDown")
    return clamp(value - span, spec.min, spec.max)
  if (key === "Home" || key === "Escape") return spec.min
  if (key === "End") return spec.max
  return null
}

export const DEMONSTRATION_SECONDS = 5

export function demonstrationValue(
  min: number,
  max: number,
  clock: number
): number {
  const elapsed = clamp(clock, 0, DEMONSTRATION_SECONDS)
  if (elapsed === 0 || elapsed === DEMONSTRATION_SECONDS) return min
  const span = max - min
  const half = DEMONSTRATION_SECONDS / 2
  if (elapsed <= half) return min + (span * elapsed) / half
  return max - (span * (elapsed - half)) / half
}
