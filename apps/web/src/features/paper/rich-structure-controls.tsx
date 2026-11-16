import { useEffect, useReducer, type ReactNode } from "react"
import { isSafeHref, normalizeLinkHref } from "@workspace/domain"
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
  | {
      kind: "open"
      href: string
      original: string
      error: string
      needsText: boolean
      text: string
    }
type LinkAction =
  | { type: "open"; href: string; needsText: boolean }
  | { type: "edit"; href: string }
  | { type: "text"; text: string }
  | { type: "error" }
  | { type: "close" }

function linkDialogReducer(state: LinkDialog, action: LinkAction): LinkDialog {
  switch (action.type) {
    case "open":
      return {
        kind: "open",
        href: action.href,
        original: action.href,
        needsText: action.needsText,
        text: "",
        error: "",
      }
    case "edit":
      return state.kind === "open"
        ? { ...state, href: action.href, error: "" }
        : state
    case "text":
      return state.kind === "open"
        ? { ...state, text: action.text, error: "" }
        : state
    case "error":
      return state.kind === "open"
        ? {
            ...state,
            error: !normalizeLinkHref(state.href)
              ? "Enter a website or email address."
              : "Enter text to display.",
          }
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
      dispatch({
        type: "open",
        href: state.href,
        needsText: state.linkNeedsText,
      })
    }
    document.addEventListener("paper-edit-link", open)
    return () => document.removeEventListener("paper-edit-link", open)
  }, [editor, blocked])
  const state = editor?.formattingState()
  const disabled = !editor || blocked
  const returnToDocument = () => editor?.apply() ?? false
  const finishInteraction = (open: boolean) => {
    if (!open) returnToDocument()
  }
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
        dispatch({
          type: "open",
          href: state?.href ?? "",
          needsText: state?.linkNeedsText ?? true,
        })
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
        onOpenChangeComplete={finishInteraction}
        value={
          state?.mixedStyle ? "mixed" : (state?.paragraphStyle ?? "normal")
        }
        disabled={disabled}
        onValueChange={(value) => {
          const style = editor?.paragraphStyles.find(
            (item) => item.id === value
          )
          if (style) editor?.apply(() => editor.setParagraphStyle(style.id))
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
                )?.label ??
                state?.paragraphStyle ??
                "Normal text")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent finalFocus={returnToDocument}>
          {state?.mixedStyle ? (
            <SelectItem value="mixed" disabled className="min-h-11 md:min-h-8">
              Mixed styles
            </SelectItem>
          ) : null}
          {editor?.paragraphStyles.map((style) => (
            <SelectItem
              key={style.id}
              value={style.id}
              className="min-h-11 md:min-h-8"
            >
              {style.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {children}
      {controls.slice(2).map(control)}
      <Dialog
        onOpenChangeComplete={finishInteraction}
        open={link !== null}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "close" })
        }}
      >
        <DialogContent finalFocus={returnToDocument}>
          <DialogHeader>
            <DialogTitle>
              {link?.original ? "Edit link" : "Add link"}
            </DialogTitle>
            <DialogDescription>
              Use a website or email address.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const applied = editor?.apply(() =>
                editor.setLink(link?.href ?? "", link?.text)
              )
              if (!applied) {
                dispatch({ type: "error" })
                return
              }
              dispatch({ type: "close" })
              refresh()
            }}
          >
            {link?.needsText ? (
              <label className="grid gap-2 text-sm">
                Text to display
                <Input
                  className="min-h-11"
                  autoFocus
                  aria-invalid={error === "Enter text to display."}
                  aria-describedby={
                    error === "Enter text to display."
                      ? "paper-link-error"
                      : undefined
                  }
                  value={link.text}
                  disabled={disabled}
                  onChange={(event) =>
                    dispatch({ type: "text", text: event.target.value })
                  }
                />
              </label>
            ) : null}
            <label className="grid gap-2 text-sm">
              Link address
              <Input
                className="min-h-11"
                autoFocus={!link?.needsText}
                type="text"
                inputMode="url"
                value={link?.href ?? ""}
                aria-invalid={error === "Enter a website or email address."}
                aria-describedby={
                  error === "Enter a website or email address."
                    ? "paper-link-error"
                    : undefined
                }
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
                  {isSafeHref(link.original) ? (
                    <a
                      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm underline focus-visible:ring-2 focus-visible:ring-ring"
                      href={link.original}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open link
                    </a>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      editor?.apply(() => editor.removeLink())
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
          editor?.apply(item.action)
          refresh()
        }}
      >
        <item.Icon />
      </Button>
    )
  }
}
