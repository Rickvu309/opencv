import { paperTableLimits } from "@workspace/domain/limits"
import { useEffect, useReducer, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Table2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ToolbarHint, type TextEditor } from "./rich-text-toolbar-control.tsx"
import { ToolbarItem } from "./rich-text-toolbar-item.tsx"
import { RichTableMenu } from "./rich-table-menu.tsx"
import { RichTableResize } from "./rich-table-resize.tsx"
import "./rich-table.css"

export function RichTableControls({
  editor,
  disabled,
  children,
}: {
  editor: TextEditor | null
  disabled: boolean
  children: (insert: (close: () => void) => ReactNode) => ReactNode
}) {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => editor?.subscribe(refresh), [editor])
  const selected = !disabled ? editor?.activeTable() : null
  const element = !disabled ? editor?.tableElement() : null
  const row = !disabled ? editor?.tableRowElement() : null
  return (
    <>
      {children((close) => (
        <InsertTable
          editor={editor}
          disabled={disabled || Boolean(selected)}
          close={close}
        />
      ))}
      {editor && selected && element && !disabled
        ? createPortal(
            <div contentEditable={false} data-paper-table-controls="">
              <RichTableResize
                editor={editor}
                selected={selected}
                element={element}
              />
            </div>,
            element
          )
        : null}
      {editor && selected && row && !disabled ? (
        <TableMenuAnchor row={row}>
          <RichTableMenu editor={editor} selected={selected} />
        </TableMenuAnchor>
      ) : null}
    </>
  )
}

function TableMenuAnchor({
  row,
  children,
}: {
  row: HTMLElement
  children: ReactNode
}) {
  const [anchor] = useReducer(
    (anchor: HTMLDivElement) => anchor,
    null,
    () => {
      const created = document.createElement("div")
      created.className = "paper-table-anchor"
      created.dataset.paperTableControls = ""
      created.contentEditable = "false"
      return created
    }
  )
  useEffect(() => {
    row.prepend(anchor)
    return () => anchor.remove()
  }, [row, anchor])
  return createPortal(children, anchor)
}

type InsertState = {
  open: boolean
  rows: string
  columns: string
  error: string
}
type InsertAction =
  | { type: "open"; value: boolean }
  | { type: "rows" | "columns" | "error"; value: string }
  | { type: "inserted" }

function InsertTable({
  editor,
  disabled,
  close,
}: {
  editor: TextEditor | null
  disabled: boolean
  close: () => void
}) {
  const [{ open, rows, columns, error }, dispatch] = useReducer(
    (state: InsertState, action: InsertAction): InsertState =>
      action.type === "inserted"
        ? { ...state, open: false, error: "" }
        : { ...state, [action.type]: action.value },
    { open: false, rows: "2", columns: "2", error: "" }
  )
  const available = !!editor && !disabled
  useEffect(() => {
    if (!available) dispatch({ type: "open", value: false })
  }, [available])
  return (
    <ToolbarItem label="Insert table">
      <Popover
        open={open && available}
        onOpenChange={(value) => {
          dispatch({ type: "error", value: "" })
          dispatch({ type: "open", value })
        }}
      >
        <ToolbarHint
          label={
            disabled && editor
              ? "Place the cursor outside the table to insert another"
              : "Insert table"
          }
        >
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Insert table"
                disabled={!editor || disabled}
                className="size-11 shrink-0 md:size-8"
                onMouseDown={(event) => event.preventDefault()}
              />
            }
          >
            <Table2 />
          </PopoverTrigger>
        </ToolbarHint>
        <PopoverContent
          align="start"
          aria-label="Insert table"
          className="w-[min(18rem,calc(100vw-2rem))]"
          finalFocus={() => editor?.focus() ?? false}
        >
          <PopoverTitle>Insert table</PopoverTitle>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!available) return
              try {
                if (!editor.insertTable(Number(rows), Number(columns))) return
                dispatch({ type: "inserted" })
                close()
              } catch (error) {
                dispatch({
                  type: "error",
                  value:
                    error instanceof Error
                      ? error.message
                      : "Choose fewer columns",
                })
              }
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                Rows
                <Input
                  aria-label="Table rows"
                  className="h-11 text-base"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={paperTableLimits.rows}
                  required
                  disabled={!available}
                  value={rows}
                  onChange={(event) =>
                    dispatch({ type: "rows", value: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1">
                Columns
                <Input
                  aria-label="Table columns"
                  className="h-11 text-base"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={paperTableLimits.columns}
                  required
                  disabled={!available}
                  value={columns}
                  onChange={(event) =>
                    dispatch({ type: "columns", value: event.target.value })
                  }
                />
              </label>
            </div>
            {error ? <p role="alert">{error}</p> : null}
            <Button disabled={!available} type="submit" className="min-h-11">
              Insert table
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </ToolbarItem>
  )
}
