import { useReducer, useRef } from "react"
import { ChevronDown, Minus, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  ToolbarChoice,
  ToolbarHint,
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

import { useToolbarGroup } from "./rich-text-toolbar-item.tsx"
import { checkPointInput, parsePointValue } from "./rich-text-point-value.ts"

const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(
  (size) => ({ value: String(size), label: `${size} pt` })
)

const sizeRange = { min: 4, max: 144, step: 0.5 } as const

function TextSize({
  editor,
  formatting,
  disabled,
  choose,
  onAction,
}: {
  editor: TextEditor | null
  formatting: TextFormatting | null
  disabled: boolean
  choose: (patch: Parameters<TextEditor["formatInline"]>[0]) => void
  onAction: () => void
}) {
  const [draft, dispatch] = useReducer(
    (
      _state: string | null,
      action: { type: "edit"; value: string } | { type: "reset" }
    ) => (action.type === "edit" ? action.value : null),
    null
  )
  const selection =
    useRef<ReturnType<TextEditor["captureSelection"]>>(undefined)
  const apply = (size: number) => {
    if (disabled || !editor) return
    editor.restoreSelection(selection.current)
    choose({ size: size * 20 })
    dispatch({ type: "reset" })
    editor.focus()
    onAction()
  }
  const typed = draft === null ? null : parsePointValue(draft)
  const step = (delta: 10 | -10) => {
    if (disabled || !editor) return
    if (typed !== null) {
      apply(
        Math.max(
          sizeRange.min,
          Math.min(sizeRange.max, Math.round(typed * 2 + delta / 10) / 2)
        )
      )
      return
    }
    editor.restoreSelection(selection.current)
    editor.stepTextSize(delta)
    dispatch({ type: "reset" })
    onAction()
  }
  const current = typed ?? (formatting?.size ? Number(formatting.size) : null)
  return (
    <ToolbarChoice
      label="Text size"
      value={formatting?.size ?? null}
      choices={sizes}
      fallback={(size) => `${Number(size).toLocaleString()} pt`}
      disabled={disabled}
      editor={editor}
      className="w-8 px-1 md:w-5 md:px-0 [&>svg:last-child]:hidden"
      icon={
        <span>
          <ChevronDown className="size-4" />
        </span>
      }
      onChange={(size) => apply(Number(size))}
      controls={
        <span className="inline-flex shrink-0 items-center">
          <ToolbarHint label="Decrease font size">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 md:h-8 md:w-5"
              aria-label="Decrease font size"
              disabled={
                disabled || (current !== null && current <= sizeRange.min)
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => step(-10)}
            >
              <Minus className="size-3.5" />
            </Button>
          </ToolbarHint>
          <ToolbarHint label="Font size (pt), 4–144 in half points">
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label="Font size (pt)"
              disabled={disabled}
              value={draft ?? formatting?.size ?? ""}
              placeholder={disabled ? "" : "Mixed"}
              className="h-11 w-16 shrink-0 px-1 text-center text-base tabular-nums md:h-8 md:w-9 md:text-sm md:placeholder:text-transparent"
              onFocus={(event) => {
                selection.current = editor?.captureSelection()
                event.currentTarget.select()
              }}
              onChange={(event) => {
                event.currentTarget.setCustomValidity("")
                dispatch({ type: "edit", value: event.currentTarget.value })
              }}
              onBlur={(event) => {
                event.currentTarget.setCustomValidity("")
                dispatch({ type: "reset" })
                selection.current = undefined
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return
                if (event.key === "Enter") {
                  event.preventDefault()
                  const value = parsePointValue(event.currentTarget.value)
                  if (
                    event.currentTarget.value.trim() &&
                    checkPointInput(event.currentTarget, sizeRange) &&
                    value !== null
                  )
                    apply(value)
                } else if (event.key === "Escape") {
                  event.preventDefault()
                  event.currentTarget.setCustomValidity("")
                  dispatch({ type: "reset" })
                  editor?.focus()
                }
              }}
            />
          </ToolbarHint>
          <ToolbarHint label="Increase font size">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 md:h-8 md:w-5"
              aria-label="Increase font size"
              disabled={
                disabled || (current !== null && current >= sizeRange.max)
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => step(10)}
            >
              <Plus className="size-3.5" />
            </Button>
          </ToolbarHint>
        </span>
      }
    />
  )
}

export function RichTextFontGroup({
  editor,
  formatting,
  disabled,
  choose,
  onAction,
}: {
  editor: TextEditor | null
  formatting: TextFormatting | null
  disabled: boolean
  choose: (patch: Parameters<TextEditor["formatInline"]>[0]) => void
  onAction: () => void
}) {
  const group = useToolbarGroup(["Font", "Text size"])
  return (
    <div
      {...group}
      role="group"
      aria-label="Font and size"
      className="flex min-w-0 items-center gap-1"
    >
      <ToolbarChoice
        label="Font"
        value={formatting?.fontId ?? null}
        choices={editor?.formattingOptions.fonts ?? []}
        disabled={disabled}
        editor={editor}
        className="w-44 min-w-0 shrink md:w-36"
        onChange={(fontId) => choose({ fontId })}
      />
      <TextSize
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={choose}
        onAction={onAction}
      />
    </div>
  )
}
