import { useLayoutEffect, useReducer, useRef } from "react"

type DetailState = { visible: boolean; minHeight: number }
type DetailAction =
  | { type: "saved" }
  | { type: "measured"; clipped: boolean; height: number; resized: boolean }

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  const next =
    action.type === "saved"
      ? { visible: false, minHeight: 0 }
      : {
          visible: action.resized
            ? action.clipped
            : state.visible || action.clipped,
          minHeight: action.resized
            ? action.clipped
              ? action.height
              : 0
            : Math.max(state.minHeight, action.height),
        }
  return next.visible === state.visible && next.minHeight === state.minHeight
    ? state
    : next
}

export function useRichStatusDetail(label: string, saved: boolean) {
  const statusRef = useRef<HTMLParagraphElement>(null)
  const layoutRef = useRef<{ width: number; font: string } | null>(null)
  const detailRef = useRef<HTMLParagraphElement>(null)
  const [{ visible, minHeight }, dispatch] = useReducer(detailReducer, {
    visible: false,
    minHeight: 0,
  })

  useLayoutEffect(() => {
    const status = statusRef.current
    if (!status) return
    const header = status.closest("header") ?? status
    const measure = () => {
      const layout = {
        width: header.getBoundingClientRect().width,
        font: getComputedStyle(status).fontSize,
      }
      const previous = layoutRef.current
      const resized =
        previous !== null &&
        (previous.width !== layout.width || previous.font !== layout.font)
      layoutRef.current = layout
      dispatch(
        saved
          ? { type: "saved" }
          : {
              type: "measured",
              resized,
              clipped: status.scrollWidth > status.clientWidth,
              height: detailRef.current?.getBoundingClientRect().height ?? 0,
            }
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(status)
    if (header !== status) observer.observe(header)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [label, saved, visible])

  return { statusRef, detailRef, visible, minHeight }
}
