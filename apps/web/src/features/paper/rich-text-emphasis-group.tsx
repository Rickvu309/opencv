import { Bold, Italic, Underline, Strikethrough } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  shortcutLabel,
  ToolbarHint,
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

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
}: {
  editor: TextEditor | null
  formatting: TextFormatting | null
  disabled: boolean
  overflow?: boolean
}) {
  return (
    <fieldset
      disabled={disabled}
      aria-label={overflow ? "More text emphasis" : "Text emphasis"}
      className="flex shrink-0 items-center gap-1"
    >
      {marks
        .filter(({ mark }) =>
          overflow ? mark === "strike" : mark !== "strike"
        )
        .map(({ mark, label, shortcut, Icon }) => (
          <ToolbarHint
            key={mark}
            label={`${label} (${shortcutLabel(shortcut)})`}
          >
            <Button
              variant={formatting?.[mark] ? "secondary" : "ghost"}
              size="icon"
              className="size-[44px] md:size-8"
              aria-label={label}
              aria-pressed={formatting?.[mark] === true}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.toggleMark(mark)}
            >
              <Icon />
            </Button>
          </ToolbarHint>
        ))}
    </fieldset>
  )
}
