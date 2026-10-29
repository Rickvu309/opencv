import { useCallback, useEffect, useReducer, useRef } from "react"

type FlashAction = { type: "triggered" } | { type: "expired" }

function flashReducer(_active: boolean, action: FlashAction) {
  return action.type === "triggered"
}

export function useFlash(ms: number): [boolean, () => void] {
  const [active, dispatch] = useReducer(flashReducer, false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const trigger = useCallback(() => {
    window.clearTimeout(timer.current)
    dispatch({ type: "triggered" })
    timer.current = window.setTimeout(() => dispatch({ type: "expired" }), ms)
  }, [ms])

  return [active, trigger]
}
