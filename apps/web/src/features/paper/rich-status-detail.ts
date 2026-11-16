import { useLayoutEffect, useReducer, useRef } from "react"

type DetailState = { visible: boolean; minHeight: number }
type DetailAction =
  { type: "saved" } | { type: "measured"; clipped: boolean; height: number }

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  const next =
    action.type === "saved"
      ? { visible: false, minHeight: 0 }
      : {
          visible: state.visible || action.clipped,
          minHeight: Math.max(state.minHeight, action.height),
        }
  return next.visible === state.visible && next.minHeight === state.minHeight
    ? state
    : next
}

export function useRichStatusDetail(label: string, saved: boolean) {
  const statusRef = useRef<HTMLSpanElement>(null)
  const detailRef = useRef<HTMLParagraphElement>(null)
  const [{ visible, minHeight }, dispatch] = useReducer(detailReducer, {
    visible: false,
    minHeight: 0,
  })

  useLayoutEffect(() => {
    const status = statusRef.current
    if (!status) return
    const measure = () => {
      dispatch(
        saved
          ? { type: "saved" }
          : {
              type: "measured",
              clipped: status.scrollWidth > status.clientWidth,
              height: detailRef.current?.getBoundingClientRect().height ?? 0,
            }
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(status)
    return () => observer.disconnect()
  }, [label, saved, visible])

  return { statusRef, detailRef, visible, minHeight }
}
