import type { ReactNode, Ref } from "react"
import {
  MacCrosshair,
  MacGrab,
  MacIbeam,
  MacOpenHand,
  MacPointer,
  MacPointingHand,
  MacResizeEW,
  MacResizeNESW,
  MacResizeNS,
  MacResizeNWSE,
  MacWait,
} from "./cursors.tsx"
import type { Point } from "./measure.ts"
import "./cursor.css"

export type CursorKind =
  | "pointer"
  | "ibeam"
  | "crosshair"
  | "hand"
  | "open"
  | "grab"
  | "wait"
  | "resize-ns"
  | "resize-ew"
  | "resize-nwse"
  | "resize-nesw"
export type CursorStyle = "real" | "large" | "circle" | "touch" | "arrow"

const GLYPHS: Record<CursorKind, () => ReactNode> = {
  pointer: MacPointer,
  ibeam: MacIbeam,
  crosshair: MacCrosshair,
  hand: MacPointingHand,
  open: MacOpenHand,
  grab: MacGrab,
  wait: MacWait,
  "resize-ns": MacResizeNS,
  "resize-ew": MacResizeEW,
  "resize-nwse": MacResizeNWSE,
  "resize-nesw": MacResizeNESW,
}

const HOTSPOT: Record<CursorKind, Point> = {
  pointer: { x: 7.5, y: 5.25 },
  ibeam: { x: 5, y: 8 },
  crosshair: { x: 8.5, y: 8.5 },
  hand: { x: 9.75, y: 3.25 },
  open: { x: 11.7, y: 10.4 },
  grab: { x: 12, y: 12 },
  wait: { x: 8, y: 8 },
  "resize-ns": { x: 10.5, y: 10.5 },
  "resize-ew": { x: 10.5, y: 10.5 },
  "resize-nwse": { x: 10.5, y: 10.5 },
  "resize-nesw": { x: 10.5, y: 10.5 },
}

const ARROW_HOTSPOT: Point = { x: 4, y: 3 }
function SolidArrow() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      className="ss-cursor__arrow"
      aria-hidden
    >
      <path d="M4 3 18.5 9.6 11.8 11.8 9.6 18.5Z" />
    </svg>
  )
}

export function Cursor({
  cursorRef,
  style = "real",
  kind,
}: {
  cursorRef: Ref<HTMLDivElement>
  style?: CursorStyle
  kind: CursorKind
}) {
  return (
    <div
      ref={cursorRef}
      className="ss-cursor"
      data-style={style}
      data-kind={kind}
      aria-hidden
    >
      {style === "touch" && <span className="ss-cursor__streak" />}
      <div className="ss-cursor__press">
        {(style === "circle" || style === "touch") && (
          <span className="ss-cursor__dot" />
        )}
        {style !== "circle" &&
          style !== "touch" &&
          (Object.keys(GLYPHS) as CursorKind[]).map((k) => {
            const arrow = style === "arrow"
            if (arrow && k !== "pointer" && k !== "ibeam") return null
            const Glyph = arrow && k === "pointer" ? SolidArrow : GLYPHS[k]
            const hot = arrow && k === "pointer" ? ARROW_HOTSPOT : HOTSPOT[k]
            const shown = arrow && kind !== "ibeam" ? "pointer" : kind
            return (
              <div
                key={k}
                className="ss-cursor__glyph"
                data-glyph={k}
                data-active={k === shown}
                style={{
                  marginLeft: -hot.x,
                  marginTop: -hot.y,
                  transformOrigin: `${hot.x}px ${hot.y}px`,
                }}
              >
                <Glyph />
              </div>
            )
          })}
      </div>
    </div>
  )
}

export function ripple(root: HTMLElement, at: Point) {
  const r = document.createElement("span")
  r.className = "ss-ripple"
  r.style.left = `${at.x}px`
  r.style.top = `${at.y}px`
  root.appendChild(r)
  r.addEventListener("animationend", () => r.remove())
}
