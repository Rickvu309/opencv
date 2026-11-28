import {
  useEffect,
  useId,
  useRef,
  useReducer,
  useSyncExternalStore,
} from "react"
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Input } from "@workspace/ui/components/input"
import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { useShortcut } from "@/lib/use-shortcut"
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
  const [replacement, setReplacement] = useReducer(
    (_: string, action: { type: "replace-text"; value: string }) =>
      action.value,
    ""
  )
  const state = useSyncExternalStore(
    editor?.search.subscribe ?? subscribeEmpty,
    editor?.search.snapshot ?? getEmpty
  )
  const open = mode !== "closed"
  const close = () => {
    editor?.search.close()
    onModeChange("closed")
    editor?.focus()
  }
  useEffect(() => {
    if (open) {
      input.current?.focus()
      input.current?.select()
    }
  }, [mode, open])
  useShortcut({
    key: ["f", "h"],
    mod: true,
    inFields: true,
    enabled: !!editor,
    prevent: false,
    onPress: (event) => {
      const key = event.key.toLowerCase()
      if (event.shiftKey && !(event.metaKey && key === "h")) return
      event.preventDefault()
      onModeChange(key === "h" ? "replace" : "find")
      input.current?.focus()
      input.current?.select()
    },
  })
  useShortcut({
    key: "Escape",
    enabled: open,
    inFields: true,
    onPress: close,
  })
  if (!open) return null
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
          event.target instanceof HTMLInputElement &&
          event.target.type !== "checkbox"
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
            className="min-w-10 shrink-0 text-center text-xs whitespace-nowrap text-muted-foreground tabular-nums"
          >
            {state.query
              ? count
                ? `${state.activeIndex + 1} of ${count}`
                : "No matches"
              : ""}
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
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 md:size-8"
                  aria-label="Find options"
                  title="Find options"
                  disabled={!editor}
                />
              }
            >
              <SlidersHorizontal />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 md:min-h-8">
                <Input
                  type="checkbox"
                  className="size-4 shrink-0 appearance-auto p-0 accent-primary"
                  disabled={!editor}
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
                disabled={!editor}
                aria-expanded={mode === "replace"}
                onClick={() =>
                  onModeChange(mode === "replace" ? "find" : "replace")
                }
              >
                {mode === "replace" ? "Hide replace" : "Find and replace"}
              </Button>
            </PopoverContent>
          </Popover>
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
          <div className="flex min-w-0 items-center gap-2">
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
              className="h-11 min-w-0 flex-1 text-base md:h-8 md:text-sm"
              onChange={(event) =>
                setReplacement({
                  type: "replace-text",
                  value: event.target.value,
                })
              }
            />
            <Button
              variant="outline"
              className="h-auto min-h-11 min-w-0 shrink px-3 whitespace-normal md:min-h-8"
              disabled={disabled || !count}
              onClick={() => editor?.search.replace(replacement, false)}
            >
              Replace
            </Button>
            <Button
              variant="outline"
              className="h-auto min-h-11 min-w-0 shrink px-3 whitespace-normal md:min-h-8"
              disabled={disabled || !count}
              onClick={() => editor?.search.replace(replacement, true)}
            >
              Replace all
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
