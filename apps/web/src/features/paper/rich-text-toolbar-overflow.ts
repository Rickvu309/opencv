import { useLayoutEffect, useReducer, type RefObject } from "react"

type OverflowState = { width: number; overflow: boolean }
type OverflowAction = { type: "resize"; width: number } | { type: "overflow" }

function overflowState(state: OverflowState, action: OverflowAction) {
  if (action.type === "overflow") return { ...state, overflow: true }
  return action.width === state.width
    ? state
    : { width: action.width, overflow: false }
}

export function useToolbarEmphasisOverflow(
  host: RefObject<HTMLDivElement | null>,
  compact: boolean
) {
  const [{ width, overflow }, dispatch] = useReducer(overflowState, {
    width: 0,
    overflow: false,
  })
  useLayoutEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) dispatch({ type: "resize", width: entry.contentRect.width })
    })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [host])
  useLayoutEffect(() => {
    const row = host.current
    if (!row || !compact || overflow || width === 0) return
    const children = Array.from(row.children)
    const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0
    const required = children.reduce(
      (total, child) => total + child.getBoundingClientRect().width,
      gap * Math.max(0, children.length - 1)
    )
    if (required > width) dispatch({ type: "overflow" })
  }, [host, compact, overflow, width])
  return compact && overflow
}
