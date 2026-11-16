import { useRef } from "react"
import type { TextEditor } from "./rich-text-toolbar-control.tsx"

type Selected = NonNullable<ReturnType<TextEditor["activeTable"]>>
type Drag = {
  pointer: number
  x: number
  width: number
  next: number
  total: number
  pixels: number
  grid: string
}
export function RichTableResize({
  editor,
  selected,
  element,
}: {
  editor: TextEditor
  selected: Selected
  element: HTMLElement
}) {
  const drag = useRef<Drag | null>(null)
  const columns = selected.table.columns
  const total = columns.reduce((sum, column) => sum + column.width, 0)
  let offset = 0
  return columns.slice(0, -1).map((column, index) => {
    offset += column.width
    const neighbor = columns[index + 1]
    if (!neighbor) return null
    const maximum = column.width + neighbor.width - 480
    return (
      <div
        key={column.id}
        role="separator"
        tabIndex={0}
        aria-label={`Resize column ${index + 1}`}
        aria-orientation="vertical"
        aria-valuemin={24}
        aria-valuemax={maximum / 20}
        aria-valuenow={column.width / 20}
        aria-valuetext={`${column.width / 20} points`}
        className="paper-table-resize"
        style={{ left: `${(offset / total) * 100}%` }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return
          event.preventDefault()
          event.stopPropagation()
          editor.resizeTableColumn(
            index,
            event.key === "Home"
              ? 480
              : event.key === "End"
                ? maximum
                : column.width +
                  (event.key === "ArrowRight" ? 1 : -1) *
                    (event.shiftKey ? 300 : 60)
          )
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current) return
          event.preventDefault()
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = {
            pointer: event.pointerId,
            x: event.clientX,
            width: column.width,
            next: column.width,
            total,
            pixels: element.getBoundingClientRect().width,
            grid: element.style.getPropertyValue("--paper-table-columns"),
          }
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current || current.pointer !== event.pointerId) return
          current.next = Math.max(
            480,
            Math.min(
              maximum,
              Math.round(
                current.width +
                  ((event.clientX - current.x) * current.total) / current.pixels
              )
            )
          )
          element.style.setProperty(
            "--paper-table-columns",
            columns
              .map(
                (item, position) =>
                  `minmax(0,${position === index ? current.next : position === index + 1 ? neighbor.width + current.width - current.next : item.width}fr)`
              )
              .join(" ")
          )
        }}
        onPointerUp={(event) => {
          const current = drag.current
          if (!current || current.pointer !== event.pointerId) return
          drag.current = null
          element.style.setProperty("--paper-table-columns", current.grid)
          event.currentTarget.releasePointerCapture(event.pointerId)
          editor.resizeTableColumn(index, current.next)
        }}
        onLostPointerCapture={() => {
          if (drag.current) {
            element.style.setProperty(
              "--paper-table-columns",
              drag.current.grid
            )
            drag.current = null
          }
        }}
      />
    )
  })
}
