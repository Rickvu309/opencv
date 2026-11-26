import { useEffect, useReducer, useRef, type ReactNode } from "react"
import { isSafeHref } from "@workspace/domain/paper-doc"
import { normalizeLinkHref } from "@workspace/domain/internal/paper-presentation"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { List, ListOrdered, Link, RemoveFormatting } from "lucide-react"

import { ToolbarHint } from "./rich-text-toolbar-control.tsx"

import { ToolbarItem } from "./rich-text-toolbar-item.tsx"

type Editor = ReturnType<typeof mountRichPaperEditor>
export function RichStructureControls({
  editor,
  blocked,
  children,
  compact = false,
}: {
  editor: Editor | null
  blocked: boolean
  compact?: boolean
  children:
    | ReactNode
    | ((slots: {
        style: ReactNode
        controls: ReactNode
        link: ReactNode
        lists: ReactNode
      }) => ReactNode)
}) {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => editor?.subscribe(refresh), [editor])
  const state = editor?.formattingState()
  const disabled = !editor || blocked
  const returnToDocument = () => editor?.apply() ?? false
  const finishInteraction = (open: boolean) => {
    if (!open) returnToDocument()
  }
  const controls = [
    {
      label: "Link",
      Icon: Link,
      action: () => document.dispatchEvent(new Event("paper-edit-link")),
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
      label: "Remove formatting",
      Icon: RemoveFormatting,
      action: () => editor?.clearFormatting(),
    },
  ]
  const styleControl = (
    <ToolbarItem label="Paragraph style">
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
          className={
            compact
              ? "min-h-11 w-14 shrink-0 border-transparent px-2 md:min-h-8"
              : "min-h-11 w-36 shrink-0 border-transparent px-2 md:min-h-8"
          }
        >
          {compact ? (
            <span aria-hidden="true" className="text-base">
              Aa
            </span>
          ) : (
            <SelectValue>
              {state?.mixedStyle
                ? "Mixed styles"
                : (editor?.paragraphStyles.find(
                    (style) => style.id === state?.paragraphStyle
                  )?.label ??
                  (state?.paragraphStyle ? "Custom style" : undefined) ??
                  "Normal text")}
            </SelectValue>
          )}
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
    </ToolbarItem>
  )
  const structureControls = controls.map(control)
  return (
    <>
      {typeof children === "function" ? (
        children({
          style: styleControl,
          controls: structureControls,
          link: structureControls[0],
          lists: structureControls.slice(1, 3),
        })
      ) : (
        <>
          {styleControl}
          {children}
          {structureControls}
        </>
      )}
    </>
  )
  function control(item: (typeof controls)[number]) {
    return (
      <ToolbarItem key={item.label} label={item.label}>
        <ToolbarHint label={item.label}>
          <Button
            variant={item.pressed ? "secondary" : "ghost"}
            size="icon"
            className="size-11 shrink-0 md:size-8"
            aria-label={item.label}
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
        </ToolbarHint>
      </ToolbarItem>
    )
  }
}

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
            error:
              state.needsText && !state.text.trim()
                ? "Enter text to display."
                : "Enter a website or email address.",
          }
        : state
    case "close":
      return { kind: "closed" }
  }
}

export function RichLinkDialog({
  editor,
  blocked,
}: {
  editor: Editor | null
  blocked: boolean
}) {
  const [dialog, dispatch] = useReducer(linkDialogReducer, { kind: "closed" })
  const textInput = useRef<HTMLInputElement>(null)
  const addressInput = useRef<HTMLInputElement>(null)
  const link = dialog.kind === "open" ? dialog : null
  const error = link?.error ?? ""
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
  const disabled = !editor || blocked
  const returnToDocument = () => editor?.apply() ?? false
  const finishInteraction = (open: boolean) => {
    if (!open) returnToDocument()
  }
  return (
    <Dialog
      onOpenChangeComplete={finishInteraction}
      open={link !== null}
      onOpenChange={(open) => {
        if (!open) dispatch({ type: "close" })
      }}
    >
      <DialogContent finalFocus={returnToDocument}>
        <DialogHeader>
          <DialogTitle>{link?.original ? "Edit link" : "Add link"}</DialogTitle>
          <DialogDescription>Use a website or email address.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const valid =
              normalizeLinkHref(link?.href ?? "") &&
              (!link?.needsText || link.text.trim())
            const applied =
              valid &&
              editor?.apply(() => editor.setLink(link?.href ?? "", link?.text))
            if (!applied) {
              dispatch({ type: "error" })
              const firstInvalid =
                link?.needsText && !link.text.trim() ? textInput : addressInput
              firstInvalid.current?.focus()
              return
            }
            dispatch({ type: "close" })
          }}
        >
          {link?.needsText ? (
            <label className="grid gap-2 text-sm">
              Text to display
              <Input
                ref={textInput}
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
              ref={addressInput}
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
                  }}
                >
                  Remove link
                </Button>
              </>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              className="ml-auto min-h-11"
              disabled={disabled}
            >
              Apply
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
