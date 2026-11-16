import { paperTableLimits } from "@workspace/domain"
import { useEffect, useReducer, useState, type ReactNode } from "react"
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
import { RichTableMenu } from "./rich-table-menu.tsx"
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
  const selected = editor?.activeTable()
  const element = editor?.tableElement()
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
            <RichTableMenu
              editor={editor}
              selected={selected}
              element={element}
            />,
            element
          )
        : null}
    </>
  )
}

function InsertTable({
  editor,
  disabled,
  close,
}: {
  editor: TextEditor | null
  disabled: boolean
  close: () => void
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState("2")
  const [columns, setColumns] = useState("2")
  const [error, setError] = useState("")
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ToolbarHint label="Insert table">
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
            try {
              editor?.insertTable(Number(rows), Number(columns))
              setOpen(false)
              close()
              setError("")
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Choose fewer columns"
              )
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
                value={rows}
                onChange={(event) => setRows(event.target.value)}
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
                value={columns}
                onChange={(event) => setColumns(event.target.value)}
              />
            </label>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <Button type="submit" className="min-h-11">
            Insert table
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
