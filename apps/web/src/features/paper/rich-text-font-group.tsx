import {
  ToolbarChoice,
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(
  (size) => ({ value: String(size), label: `${size} pt` })
)

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
  return (
    <div
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
      <ToolbarChoice
        label="Text size"
        value={formatting?.size ?? null}
        choices={sizes}
        fallback={(size) => `${Number(size).toLocaleString()} pt`}
        disabled={disabled}
        editor={editor}
        className="w-20"
        onChange={(size) => choose({ size: Number(size) * 20 })}
      />
    </div>
  )
}
