import { useEffect, useReducer, useState, type ReactNode } from "react"
import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import {
  Undo2,
  Redo2,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Link,
  RemoveFormatting,
} from "lucide-react"

type Editor = ReturnType<typeof mountRichPaperEditor>

export function RichStructureControls({
  editor,
  blocked,
  children,
}: {
  editor: Editor | null
  blocked: boolean
  children: ReactNode
}) {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  const [link, setLink] = useState<{ href: string; original: string } | null>(
    null
  )
  const [error, setError] = useState("")
  useEffect(() => editor?.subscribe(refresh), [editor])
  useEffect(() => {
    const open = () => {
      const state = editor?.formattingState()
      if (blocked || !state?.canLink) return
      setError("")
      setLink({ href: state.href, original: state.href })
    }
    document.addEventListener("paper-edit-link", open)
    return () => document.removeEventListener("paper-edit-link", open)
  }, [editor, blocked])
  const state = editor?.formattingState()
  const disabled = !editor || blocked
  const controls = [
    {
      label: "Undo",
      Icon: Undo2,
      action: () => editor?.undo(),
      disabled: !state?.canUndo,
    },
    {
      label: "Redo",
      Icon: Redo2,
      action: () => editor?.redo(),
      disabled: !state?.canRedo,
    },
    {
      label: "Link",
      Icon: Link,
      action: () => {
        setError("")
        setLink({ href: state?.href ?? "", original: state?.href ?? "" })
      },
      disabled: !state?.canLink,
    },
    {
      label: "Bulleted list",
      Icon: List,
      action: () => editor?.toggleList("bulletListItem"),
      pressed: state?.list === "bulletListItem",
    },
    {
      label: "Numbered list",
      Icon: ListOrdered,
      action: () => editor?.toggleList("numberedListItem"),
      pressed: state?.list === "numberedListItem",
    },
    {
      label: "Increase indent",
      Icon: IndentIncrease,
      action: () => editor?.listLevel("in"),
      disabled: !state?.canIndent,
    },
    {
      label: "Decrease indent",
      Icon: IndentDecrease,
      action: () => editor?.listLevel("out"),
      disabled: !state?.canOutdent,
    },
    {
      label: "Remove formatting",
      Icon: RemoveFormatting,
      action: () => editor?.clearFormatting(),
    },
  ]
  return (
    <>
      {controls.slice(0, 2).map(control)}
      <select
        aria-label="Paragraph style"
        className="h-11 max-w-36 shrink-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8"
        value={
          state?.mixedStyle ? "mixed" : (state?.paragraphStyle ?? "normal")
        }
        disabled={disabled}
        onChange={(event) => {
          const style = editor?.paragraphStyles.find(
            (item) => item.id === event.target.value
          )
          if (style) editor?.setParagraphStyle(style.id)
        }}
      >
        {state?.mixedStyle ? <option value="mixed">Mixed styles</option> : null}
        {editor?.paragraphStyles.map((style) => (
          <option key={style.id} value={style.id}>
            {style.label}
          </option>
        ))}
      </select>
      {children}
      {controls.slice(2).map(control)}
      <Dialog
        open={link !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLink(null)
            editor?.focus()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {link?.original ? "Edit link" : "Add link"}
            </DialogTitle>
            <DialogDescription>
              Use an http, https or mailto address.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!editor?.setLink(link?.href.trim() ?? "")) {
                setError("Enter an http, https or mailto address.")
                return
              }
              setLink(null)
              refresh()
            }}
          >
            <label className="grid gap-2 text-sm">
              Link address
              <Input
                className="min-h-11"
                autoFocus
                type="text"
                inputMode="url"
                value={link?.href ?? ""}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "paper-link-error" : undefined}
                onChange={(event) => {
                  setError("")
                  setLink({
                    href: event.target.value,
                    original: link?.original ?? "",
                  })
                }}
              />
            </label>
            {error ? (
              <p
                id="paper-link-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {link?.original ? (
                <>
                  <a
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm underline focus-visible:ring-2 focus-visible:ring-ring"
                    href={link.original}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open link
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      editor?.removeLink()
                      setLink(null)
                      refresh()
                    }}
                  >
                    Remove link
                  </Button>
                </>
              ) : null}
              <Button
                type="submit"
                className="ml-auto min-h-11"
                disabled={disabled}
              >
                Apply
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
  function control(item: (typeof controls)[number]) {
    return (
      <Button
        key={item.label}
        variant={item.pressed ? "secondary" : "ghost"}
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label={item.label}
        title={item.label}
        aria-pressed={item.pressed}
        disabled={disabled || item.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          item.action()
          refresh()
        }}
      >
        <item.Icon />
      </Button>
    )
  }
}
