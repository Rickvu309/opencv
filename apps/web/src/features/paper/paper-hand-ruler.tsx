import { useRef, type KeyboardEvent, type PointerEvent } from "react"

import {
  RULER_NARROW_WIDTH_PX,
  RULER_WIDTH_PX,
  rulerMarks,
  rulerNumberAt,
  rulerOffset,
  rulerTicks,
} from "./paper-hand-ruler-marks.ts"

const PAGE_JUMP = 7
const LABEL_HIDE_PX = 16

function keyTarget(key: string, number: number, total: number) {
  if (key === "ArrowRight" || key === "ArrowUp") return number + 1
  if (key === "ArrowLeft" || key === "ArrowDown") return number - 1
  if (key === "PageUp") return number + PAGE_JUMP
  if (key === "PageDown") return number - PAGE_JUMP
  if (key === "Home") return 1
  if (key === "End") return total
  return null
}

export function PaperHandRuler({
  number,
  total,
  narrow,
  onSeek,
}: {
  number: number
  total: number
  narrow: boolean
  onSeek: (index: number) => void
}) {
  const trackRef = useRef<HTMLSpanElement>(null)
  const scrubbing = useRef(false)
  const width = narrow ? RULER_NARROW_WIDTH_PX : RULER_WIDTH_PX
  const marks = rulerMarks(total, width)
  const ticks = rulerTicks(total, marks)
  const low = Math.max(1, number - 3)
  const high = Math.min(total, number + 3)
  const nowPx = (rulerOffset(number, total) / 100) * width

  function seekAt(clientX: number) {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    onSeek(rulerNumberAt((clientX - box.left) / box.width, total) - 1)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    scrubbing.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    seekAt(event.clientX)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = keyTarget(event.key, number, total)
    if (next === null) return
    event.preventDefault()
    onSeek(Math.min(total, Math.max(1, next)) - 1)
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Move through your documents"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={number}
      aria-valuetext={`${number} of ${total}`}
      className="paper-hand-ruler"
      onPointerDown={onPointerDown}
      onPointerMove={(event) => {
        if (scrubbing.current) seekAt(event.clientX)
      }}
      onPointerUp={() => {
        scrubbing.current = false
      }}
      onPointerCancel={() => {
        scrubbing.current = false
      }}
      onLostPointerCapture={() => {
        scrubbing.current = false
      }}
      onKeyDown={onKeyDown}
    >
      <span ref={trackRef} className="paper-hand-ruler-track">
        <span
          className="paper-hand-ruler-window"
          style={{
            insetInlineStart: `${rulerOffset(low, total)}%`,
            width: `${rulerOffset(high, total) - rulerOffset(low, total)}%`,
          }}
        />
        <span className="paper-hand-ruler-ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <i
              key={tick}
              data-major={marks.includes(tick) || undefined}
              style={{ insetInlineStart: `${rulerOffset(tick, total)}%` }}
            />
          ))}
        </span>
        <span
          className="paper-hand-ruler-mark"
          style={{ insetInlineStart: `${rulerOffset(number, total)}%` }}
        >
          <b>{number}</b>
        </span>
        <span className="paper-hand-ruler-labels" aria-hidden="true">
          {marks.map((mark) => (
            <span
              key={mark}
              data-under={
                Math.abs((rulerOffset(mark, total) / 100) * width - nowPx) <
                  LABEL_HIDE_PX || undefined
              }
              style={{ insetInlineStart: `${rulerOffset(mark, total)}%` }}
            >
              {mark}
            </span>
          ))}
        </span>
      </span>
    </div>
  )
}
