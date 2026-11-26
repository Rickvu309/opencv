import { paperTableLimits } from "@workspace/domain/limits"
import { useReducer, useRef } from "react"
import { Ellipsis } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { RichTableBorders } from "./rich-table-borders.tsx"
import type { TextEditor } from "./rich-text-toolbar-control.tsx"

type Selected = NonNullable<ReturnType<TextEditor["activeTable"]>>
type MenuAction =
  | { type: "open"; value: boolean }
  | { type: "error"; value: string }
  | { type: "completed" }
export function RichTableMenu({
  editor,
  selected,
}: {
  editor: TextEditor
  selected: Selected
}) {
  const [{ open, error }, dispatch] = useReducer(
    (state: { open: boolean; error: string }, action: MenuAction) =>
      action.type === "completed"
        ? { open: false, error: "" }
        : {
            ...state,
            [action.type]: action.value,
            error: action.type === "open" ? "" : action.value,
          },
    { open: false, error: "" }
  )
  const width = useRef<HTMLInputElement>(null)
  const column = selected.table.columns[selected.columnIndex]
  const neighbor =
    selected.table.columns[selected.columnIndex + 1] ??
    selected.table.columns[selected.columnIndex - 1]
  const page = selected.section.page
  const printable =
    (page.width -
      page.start -
      page.end -
      (selected.section.columns.count - 1) * selected.section.columns.gap) /
    selected.section.columns.count
  const maximumWidth =
    column && neighbor ? column.width + neighbor.width - 480 : printable
  const cannotAddColumn =
    selected.table.columns.length >= paperTableLimits.columns ||
    printable < (selected.table.columns.length + 1) * 480
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
      disabled: cannotAddColumn,
    },
    {
      label: "Insert column right",
      run: () => editor.addTableColumn(),
      disabled: cannotAddColumn,
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
      <Popover
        open={open}
        onOpenChange={(value) => dispatch({ type: "open", value })}
      >
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
          className="max-h-[calc(100dvh-3rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain"
          finalFocus={() => editor.focus()}
        >
          <PopoverTitle>Table options</PopoverTitle>
          <p className="text-xs text-muted-foreground">
            Row {selected.rowIndex + 1}, column {selected.columnIndex + 1}
          </p>
          <RichTableBorders
            editor={editor}
            borders={selected.table.borders}
            onError={(value) => dispatch({ type: "error", value })}
          />
          <div className="grid gap-1">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                className="min-h-11 justify-start"
                disabled={action.disabled}
                onClick={() => {
                  try {
                    if (!action.run()) return
                    dispatch({ type: "completed" })
                    editor.focus()
                  } catch (error) {
                    dispatch({
                      type: "error",
                      value:
                        error instanceof Error
                          ? error.message
                          : "Table could not change",
                    })
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
                  try {
                    if (
                      !editor.resizeTableColumn(
                        selected.columnIndex,
                        value * 20
                      )
                    )
                      return
                    dispatch({ type: "completed" })
                    editor.focus()
                  } catch (error) {
                    dispatch({
                      type: "error",
                      value:
                        error instanceof Error
                          ? error.message
                          : "Column could not resize",
                    })
                  }
                }
              }}
            >
              <label className="grid gap-1">
                Column width (pt)
                <Input
                  ref={width}
                  key={`${column.id}-${column.width}`}
                  aria-label="Column width in points"
                  className="h-11 text-base"
                  type="number"
                  min={24}
                  max={maximumWidth / 20}
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
    </div>
  )
}
