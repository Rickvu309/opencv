import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import "./rich-find-bar.css"

export type PaperFindMode = "closed" | "find" | "replace"
type Editor = ReturnType<typeof mountRichPaperEditor>
const empty = { query: "", matchCase: false, matches: [], activeIndex: -1 }
const getEmpty = () => empty
const subscribeEmpty = () => () => {}

export function RichFindBar({
  editor,
  disabled,
  mode,
  onModeChange,
}: {
  editor: Editor | null
  disabled: boolean
  mode: PaperFindMode
  onModeChange: (mode: PaperFindMode) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const replacementId = useId()
  const [replacement, setReplacement] = useState("")
  const state = useSyncExternalStore(
    editor?.search.subscribe ?? subscribeEmpty,
    editor?.search.snapshot ?? getEmpty
  )
  const open = mode !== "closed"
  useEffect(() => {
    if (open) {
      input.current?.focus()
      input.current?.select()
    }
  }, [mode, open])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !event.isComposing) {
        event.preventDefault()
        editor?.search.close()
        onModeChange("closed")
        editor?.focus()
        return
      }
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing
      )
        return
      const key = event.key.toLowerCase()
      if ((key !== "f" && key !== "h") || !editor) return
      event.preventDefault()
      onModeChange(key === "h" ? "replace" : "find")
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [editor, onModeChange, open])
  if (!open) return null
  const close = () => {
    editor?.search.close()
    onModeChange("closed")
    editor?.focus()
  }
  const count = state.matches.length
  return (
    <div
      role="search"
      aria-label="Find in document"
      className="paper-find-bar shrink-0 border-b bg-background p-3"
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          close()
        } else if (
          event.key === "Enter" &&
          event.target instanceof HTMLInputElement
        ) {
          event.preventDefault()
          editor?.search.move(event.shiftKey ? -1 : 1)
        }
      }}
    >
      <div className="paper-find-fields mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Input
            ref={input}
            aria-label="Find in document"
            placeholder="Find in document"
            value={state.query}
            disabled={!editor}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            className="h-11 min-w-0 flex-1 text-base md:h-8 md:text-sm"
            onChange={(event) =>
              editor?.search.find(event.target.value, state.matchCase)
            }
          />
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="min-w-12 shrink-0 text-center text-xs text-muted-foreground tabular-nums"
          >
            {state.query ? `${state.activeIndex + 1} of ${count}` : "Find"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:size-8"
            aria-label="Previous match"
            title="Previous match (Shift+Enter)"
            disabled={!count}
            onClick={() => editor?.search.move(-1)}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:size-8"
            aria-label="Next match"
            title="Next match (Enter)"
            disabled={!count}
            onClick={() => editor?.search.move(1)}
          >
            <ChevronDown />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:size-8"
            aria-label="Close find"
            title="Close (Escape)"
            onClick={close}
          >
            <X />
          </Button>
        </div>
        {mode === "replace" ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label htmlFor={replacementId} className="sr-only">
              Replace with
            </label>
            <Input
              id={replacementId}
              placeholder="Replace with"
              value={replacement}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11 min-w-0 flex-[1_1_12rem] text-base md:h-8 md:text-sm"
              onChange={(event) => setReplacement(event.target.value)}
            />
            <Button
              variant="outline"
              className="min-h-11 md:min-h-8"
              disabled={disabled || !count}
              onClick={() => editor?.search.replace(replacement, false)}
            >
              Replace
            </Button>
            <Button
              variant="outline"
              className="min-h-11 md:min-h-8"
              disabled={disabled || !count}
              onClick={() => editor?.search.replace(replacement, true)}
            >
              Replace all
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 md:min-h-8">
            <input
              type="checkbox"
              checked={state.matchCase}
              onChange={(event) =>
                editor?.search.find(state.query, event.target.checked)
              }
            />
            Match case
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 md:min-h-8"
            aria-expanded={mode === "replace"}
            onClick={() =>
              onModeChange(mode === "replace" ? "find" : "replace")
            }
          >
            {mode === "replace" ? "Hide replace" : "Find and replace"}
          </Button>
          {state.query && !count ? (
            <span className="text-muted-foreground">No matches</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
