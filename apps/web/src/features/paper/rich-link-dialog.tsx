import { useEffect, useReducer, useRef } from "react"
import { isSafeHref } from "@workspace/domain"
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
