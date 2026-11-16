import { useEffect, useReducer, type ReactNode } from "react"
import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
type LinkDialog =
  | { kind: "closed" }
  | { kind: "open"; href: string; original: string; error: string }
type LinkAction =
  | { type: "open"; href: string }
  | { type: "edit"; href: string }
  | { type: "error" }
  | { type: "close" }

function linkDialogReducer(state: LinkDialog, action: LinkAction): LinkDialog {
  switch (action.type) {
    case "open":
      return {
        kind: "open",
        href: action.href,
        original: action.href,
        error: "",
      }
    case "edit":
      return state.kind === "open"
        ? { ...state, href: action.href, error: "" }
        : state
    case "error":
      return state.kind === "open"
        ? { ...state, error: "Enter an http, https or mailto address." }
        : state
    case "close":
      return { kind: "closed" }
  }
}

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
  const [dialog, dispatch] = useReducer(linkDialogReducer, { kind: "closed" })
  const link = dialog.kind === "open" ? dialog : null
  const error = link?.error ?? ""
  useEffect(() => editor?.subscribe(refresh), [editor])
  useEffect(() => {
    const open = () => {
      const state = editor?.formattingState()
      if (blocked || !state?.canLink) return
      dispatch({ type: "open", href: state.href })
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
        dispatch({ type: "open", href: state?.href ?? "" })
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
      <Select
        value={
          state?.mixedStyle ? "mixed" : (state?.paragraphStyle ?? "normal")
        }
        disabled={disabled}
        onValueChange={(value) => {
          const style = editor?.paragraphStyles.find(
            (item) => item.id === value
          )
          if (style) editor?.setParagraphStyle(style.id)
        }}
      >
        <SelectTrigger
          aria-label="Paragraph style"
          className="max-w-36 shrink-0 data-[size=default]:h-11 data-[size=default]:md:h-8"
        >
          <SelectValue>
            {state?.mixedStyle
              ? "Mixed styles"
              : (editor?.paragraphStyles.find(
                  (style) => style.id === state?.paragraphStyle
                )?.label ?? "Normal text")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {state?.mixedStyle ? (
            <SelectItem value="mixed" disabled>
              Mixed styles
            </SelectItem>
          ) : null}
          {editor?.paragraphStyles.map((style) => (
            <SelectItem key={style.id} value={style.id}>
              {style.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {children}
      {controls.slice(2).map(control)}
      <Dialog
        open={link !== null}
        onOpenChange={(open) => {
          if (!open) {
            dispatch({ type: "close" })
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
                dispatch({ type: "error" })
                return
              }
              dispatch({ type: "close" })
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
                  dispatch({ type: "edit", href: event.target.value })
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
                      dispatch({ type: "close" })
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
