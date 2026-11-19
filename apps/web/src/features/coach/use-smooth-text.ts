import { useEffect, useReducer, useRef } from "react"

import { prefersReducedMotion } from "@workspace/ui/lib/motion"

export const WORD_PACE_MS = 24
export const CATCH_UP_WORDS = 4
const FIRST_FRAME_MS = 16

export type Reveal = { length: number; credit: number }

export function wordEnds(text: string) {
  return [...text.matchAll(/\s*\S+\s*/g)].map(
    (match) => match.index + match[0].length
  )
}

export function revealStep(
  state: Reveal,
  text: string,
  elapsed: number
): Reveal {
  const start = Math.min(state.length, text.length)
  const ahead = wordEnds(text).filter((end) => end > start)
  if (ahead.length === 0) return { length: text.length, credit: 0 }
  const interval = WORD_PACE_MS / Math.max(1, ahead.length / CATCH_UP_WORDS)
  const credit = state.credit + Math.max(0, elapsed) / interval
  const words = Math.min(ahead.length, Math.floor(credit))
  return {
    length: words > 0 ? ahead[words - 1]! : start,
    credit: credit - words,
  }
}

type RevealAction =
  | { type: "frame"; text: string; elapsed: number }
  | { type: "all"; text: string }

function reveal(state: Reveal, action: RevealAction): Reveal {
  return action.type === "all"
    ? { length: action.text.length, credit: 0 }
    : revealStep(state, action.text, action.elapsed)
}

export function useSmoothText(text: string) {
  const [state, dispatch] = useReducer(reveal, text, (initial) => ({
    length: prefersReducedMotion() ? initial.length : 0,
    credit: 0,
  }))
  const lastFrame = useRef<number | null>(null)
  const length = Math.min(state.length, text.length)

  useEffect(() => {
    if (length >= text.length) {
      lastFrame.current = null
      return
    }
    if (prefersReducedMotion()) {
      dispatch({ type: "all", text })
      return
    }
    const frame = requestAnimationFrame((now) => {
      const elapsed =
        lastFrame.current === null ? FIRST_FRAME_MS : now - lastFrame.current
      lastFrame.current = now
      dispatch({ type: "frame", text, elapsed })
    })
    return () => cancelAnimationFrame(frame)
  }, [state, length, text])

  return text.slice(0, length)
}
