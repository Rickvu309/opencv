import { Bold, Italic, Underline, Strikethrough } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  shortcutLabel,
  ToolbarHint,
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

import { ToolbarItem, useToolbarGroup } from "./rich-text-toolbar-item.tsx"

const marks = [
  { mark: "bold", label: "Bold", shortcut: "Ctrl+B", Icon: Bold },
  { mark: "italic", label: "Italic", shortcut: "Ctrl+I", Icon: Italic },
  {
    mark: "underline",
    label: "Underline",
    shortcut: "Ctrl+U",
    Icon: Underline,
  },
  {
    mark: "strike",
    label: "Strikethrough",
    shortcut: "Ctrl+Shift+X",
    Icon: Strikethrough,
  },
] as const

export function RichTextEmphasisGroup({
  editor,
  formatting,
  disabled,
  overflow = false,
  all = false,
  onAction,
}: {
  editor: TextEditor | null
  formatting: TextFormatting | null
  disabled: boolean
  overflow?: boolean
  all?: boolean
  onAction?: () => void
}) {
  const ordered = all ? [marks[0], marks[1], marks[3], marks[2]] : marks
  const selected = ordered.filter(
    ({ mark }) => all || (overflow ? mark === "strike" : mark !== "strike")
  )
  const group = useToolbarGroup(selected.map(({ label }) => label))
  return (
    <fieldset
      {...group}
      disabled={disabled}
      aria-label={overflow ? "More text emphasis" : "Text emphasis"}
      className="flex shrink-0 items-center gap-1"
    >
      {selected.map(({ mark, label, shortcut, Icon }) => (
        <ToolbarItem key={mark} label={label}>
          <ToolbarHint label={`${label} (${shortcutLabel(shortcut)})`}>
            <Button
              variant={formatting?.[mark] ? "secondary" : "ghost"}
              size="icon"
              className="size-[44px] md:size-8"
              aria-label={label}
              aria-pressed={formatting?.[mark] === true}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor?.toggleMark(mark)
                onAction?.()
              }}
            >
              <Icon />
            </Button>
          </ToolbarHint>
        </ToolbarItem>
      ))}
    </fieldset>
  )
}
