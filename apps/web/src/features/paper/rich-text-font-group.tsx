import { useRef, useState } from "react"
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

const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(
  (size) => ({ value: String(size), label: `${size} pt` })
)

function TextSize({
  editor,
  formatting,
  disabled,
  choose,
}: {
  editor: TextEditor | null
  formatting: TextFormatting | null
  disabled: boolean
  choose: (patch: Parameters<TextEditor["formatInline"]>[0]) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const selection =
    useRef<ReturnType<TextEditor["captureSelection"]>>(undefined)
  const apply = (size: number) => {
    if (disabled || !editor) return
    editor.restoreSelection(selection.current)
    choose({ size: size * 20 })
    setDraft(null)
    editor.focus()
  }
  const step = (delta: number) => {
    const value = Number(draft ?? formatting?.size ?? 11)
    if (!Number.isFinite(value)) return
    apply(Math.max(4, Math.min(144, Math.round(value * 2 + delta * 2) / 2)))
  }
  const current = Number(draft ?? formatting?.size ?? 11)
  return (
    <ToolbarChoice
      label="Text size"
      value={formatting?.size ?? null}
      choices={sizes}
      fallback={(size) => `${Number(size).toLocaleString()} pt`}
      disabled={disabled}
      editor={editor}
      className="w-8 px-1 [&>svg:last-child]:hidden"
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
              className="size-11 shrink-0 md:size-8"
              aria-label="Decrease font size"
              disabled={disabled || current <= 4}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => step(-0.5)}
            >
              <Minus className="size-3.5" />
            </Button>
          </ToolbarHint>
          <ToolbarHint label="Font size (pt), 4–144 in half points">
            <Input
              type="number"
              aria-label="Font size (pt)"
              min={4}
              max={144}
              step={0.5}
              disabled={disabled}
              value={draft ?? formatting?.size ?? ""}
              placeholder={disabled ? "—" : "Mixed"}
              className="h-11 w-16 shrink-0 [appearance:textfield] px-1 text-center text-base tabular-nums md:h-8 md:w-14 md:text-sm [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={(event) => {
                selection.current = editor?.captureSelection()
                event.currentTarget.select()
              }}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onBlur={() => {
                setDraft(null)
                selection.current = undefined
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  if (
                    event.currentTarget.value &&
                    event.currentTarget.reportValidity()
                  )
                    apply(event.currentTarget.valueAsNumber)
                } else if (event.key === "Escape") {
                  event.preventDefault()
                  setDraft(null)
                  editor?.focus()
                }
              }}
            />
          </ToolbarHint>
          <ToolbarHint label="Increase font size">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 md:size-8"
              aria-label="Increase font size"
              disabled={disabled || current >= 144}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => step(0.5)}
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
}: {
  editor: TextEditor | null
  formatting: TextFormatting | null
  disabled: boolean
  choose: (patch: Parameters<TextEditor["formatInline"]>[0]) => void
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
        className="w-44 min-w-0 shrink"
        onChange={(fontId) => choose({ fontId })}
      />
      <TextSize
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={choose}
      />
    </div>
  )
}
