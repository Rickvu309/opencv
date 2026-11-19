import { useEffect, useLayoutEffect, useReducer, useRef } from "react"

import { PaperActionMenu, type PaperCardAction } from "./paper-library-card.tsx"
import { PaperHandRuler } from "./paper-hand-ruler.tsx"
import { rulerShown } from "./paper-hand-ruler-marks.ts"

import "./design/paper-hand-caption.css"

const TIP_MS = 2600

type TipState = { cut: boolean; shown: boolean }
type TipAction =
  { type: "measured"; cut: boolean } | { type: "toggle" } | { type: "hide" }

function tipReducer(state: TipState, action: TipAction): TipState {
  if (action.type === "measured")
    return state.cut === action.cut
      ? state
      : { cut: action.cut, shown: state.shown && action.cut }
  if (action.type === "toggle")
    return state.cut ? { ...state, shown: !state.shown } : state
  return state.shown ? { ...state, shown: false } : state
}

export function PaperHandCaption({
  name,
  edited,
  number,
  total,
  narrow,
  actions,
  onSeek,
}: {
  name: string
  edited: string
  number: number
  total: number
  narrow: boolean
  actions: PaperCardAction[]
  onSeek: (index: number) => void
}) {
  const [tip, dispatch] = useReducer(tipReducer, { cut: false, shown: false })
  const nameRef = useRef<HTMLSpanElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = nameRef.current
    if (!node) return
    dispatch({ type: "measured", cut: node.scrollWidth > node.clientWidth + 1 })
  }, [name, narrow])

  useEffect(() => {
    dispatch({ type: "hide" })
  }, [name])

  useEffect(() => {
    if (!tip.shown) return
    const timer = window.setTimeout(() => dispatch({ type: "hide" }), TIP_MS)
    function onPointerDown(event: PointerEvent) {
      if (lineRef.current?.contains(event.target as Node)) return
      dispatch({ type: "hide" })
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [tip.shown])

  return (
    <div className="paper-hand-caption">
      <div aria-live="polite">
        <div
          ref={lineRef}
          className="paper-hand-caption-line"
          data-cut={tip.cut || undefined}
          data-shown={tip.shown || undefined}
        >
          <span
            ref={nameRef}
            className="paper-hand-caption-name"
            onClick={() => dispatch({ type: "toggle" })}
          >
            {name}
          </span>
          {tip.cut ? (
            <span className="paper-hand-caption-full" aria-hidden="true">
              {name}
            </span>
          ) : null}
          <PaperActionMenu
            className="paper-hand-more"
            label={`${name} menu`}
            actions={actions}
          />
        </div>
        <span className="paper-hand-caption-meta">{edited}</span>
      </div>
      {rulerShown(total) ? (
        <PaperHandRuler
          number={number}
          total={total}
          narrow={narrow}
          onSeek={onSeek}
        />
      ) : null}
    </div>
  )
}
