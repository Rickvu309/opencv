import { useEffect, useReducer, useRef } from "react"
import type { TextEditor } from "./rich-text-toolbar-control.tsx"

type Selected = NonNullable<ReturnType<TextEditor["activeTable"]>>
type Drag = {
  pointer: number
  x: number
  width: number
  next: number
  total: number
  pixels: number
  grids: { element: HTMLElement; columns: string }[]
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
  const [error, setError] = useReducer((_: string, value: string) => value, "")
  const resize = (index: number, width: number) => {
    try {
      editor.resizeTableColumn(index, width)
      setError("")
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Column could not resize"
      )
    }
  }
  const cancel = () => {
    for (const grid of drag.current?.grids ?? [])
      grid.element.style.gridTemplateColumns = grid.columns
    drag.current = null
  }
  useEffect(() => cancel, [editor, element])
  const columns = selected.table.columns
  const total = columns.reduce((sum, column) => sum + column.width, 0)
  return (
    <>
      {columns.slice(0, -1).map((column, index) => {
        const offset = columns
          .slice(0, index + 1)
          .reduce((sum, item) => sum + item.width, 0)
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
            style={{ insetInlineStart: `${(offset / total) * 100}%` }}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return
              event.preventDefault()
              event.stopPropagation()
              resize(
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
                grids: Array.from(
                  element.querySelectorAll<HTMLElement>(
                    '[data-paper-layout="paperRow"]'
                  )
                ).flatMap((row) =>
                  Array.from(row.children).flatMap((child) =>
                    child instanceof HTMLElement &&
                    child.style.gridTemplateColumns
                      ? [
                          {
                            element: child,
                            columns: child.style.gridTemplateColumns,
                          },
                        ]
                      : []
                  )
                ),
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
                      ((event.clientX - current.x) * current.total) /
                        current.pixels
                  )
                )
              )
              const preview = columns
                .map(
                  (item, position) =>
                    `minmax(0,${position === index ? current.next : position === index + 1 ? neighbor.width + current.width - current.next : item.width}fr)`
                )
                .join(" ")
              for (const grid of current.grids)
                grid.element.style.gridTemplateColumns = preview
            }}
            onPointerUp={(event) => {
              const current = drag.current
              if (!current || current.pointer !== event.pointerId) return
              drag.current = null
              for (const grid of current.grids)
                grid.element.style.gridTemplateColumns = grid.columns
              event.currentTarget.releasePointerCapture(event.pointerId)
              resize(index, current.next)
            }}
            onPointerCancel={cancel}
            onLostPointerCapture={cancel}
          />
        )
      })}
      {error ? <p role="alert">{error}</p> : null}
    </>
  )
}
