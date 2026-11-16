import { paperTableLimits } from "@workspace/domain"
import { useRef, useState } from "react"
import { Ellipsis } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import type { TextEditor } from "./rich-text-toolbar-control.tsx"
import { RichTableResize } from "./rich-table-resize.tsx"

type Selected = NonNullable<ReturnType<TextEditor["activeTable"]>>
export function RichTableMenu({
  editor,
  selected,
  element,
}: {
  editor: TextEditor
  selected: Selected
  element: HTMLElement
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const width = useRef<HTMLInputElement>(null)
  const column = selected.table.columns[selected.columnIndex]
  const actions = [
    {
      label: "Insert row above",
      run: () => editor.addTableRow(false),
      disabled: selected.table.children.length >= paperTableLimits.rows,
    },
    {
      label: "Insert row below",
      run: () => editor.addTableRow(),
      disabled: selected.table.children.length >= paperTableLimits.rows,
    },
    {
      label: "Insert column left",
      run: () => editor.addTableColumn(false),
      disabled: selected.table.columns.length >= paperTableLimits.columns,
    },
    {
      label: "Insert column right",
      run: () => editor.addTableColumn(),
      disabled: selected.table.columns.length >= paperTableLimits.columns,
    },
    {
      label: "Delete row",
      run: () => editor.removeTableRow(),
      disabled: selected.table.children.length === 1,
    },
    {
      label: "Delete column",
      run: () => editor.removeTableColumn(),
      disabled: selected.table.columns.length === 1,
    },
    { label: "Delete table", run: () => editor.removeTable(), disabled: false },
  ]
  return (
    <div contentEditable={false} data-paper-table-controls="">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              className="paper-table-menu size-11 rounded-full border bg-background shadow-sm"
              variant="outline"
              size="icon"
              aria-label="Table options"
              onMouseDown={(event) => event.preventDefault()}
            />
          }
        >
          <Ellipsis />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          aria-label="Table options"
          className="max-h-[calc(100dvh-3rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto"
          finalFocus={() => editor.focus()}
        >
          <PopoverTitle>Table options</PopoverTitle>
          <p className="text-xs text-muted-foreground">
            Row {selected.rowIndex + 1}, column {selected.columnIndex + 1}
          </p>
          <div className="grid gap-1">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                className="min-h-11 justify-start"
                disabled={action.disabled}
                onClick={() => {
                  try {
                    action.run()
                    setOpen(false)
                    setError("")
                    editor.focus()
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Table could not change"
                    )
                  }
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
          {column ? (
            <form
              className="grid gap-2 border-t pt-2"
              onSubmit={(event) => {
                event.preventDefault()
                const value = width.current?.valueAsNumber
                if (value && Number.isFinite(value)) {
                  editor.resizeTableColumn(selected.columnIndex, value * 20)
                  setOpen(false)
                  editor.focus()
                }
              }}
            >
              <label className="grid gap-1">
                Column width (pt)
                <input
                  ref={width}
                  key={`${column.id}-${column.width}`}
                  aria-label="Column width in points"
                  className="h-11 min-w-0 rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
                  type="number"
                  min={24}
                  max={1584}
                  step="any"
                  defaultValue={column.width / 20}
                  required
                />
              </label>
              <Button type="submit" variant="outline" className="min-h-11">
                Set column width
              </Button>
            </form>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </PopoverContent>
      </Popover>
      <RichTableResize editor={editor} selected={selected} element={element} />
    </div>
  )
}
