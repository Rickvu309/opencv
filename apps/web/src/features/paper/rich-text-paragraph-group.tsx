import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ListStart,
  IndentDecrease,
  IndentIncrease,
  ArrowDownWideNarrow,
  WrapText,
} from "lucide-react"
import {
  ToolbarButton,
  ToolbarChoice,
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

const alignments = [
  { value: "left", label: "Left", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Right", Icon: AlignRight },
  { value: "justify", label: "Justified", Icon: AlignJustify },
] as const
const spacings = [
  { value: "1", label: "Single" },
  { value: "1.15", label: "1.15" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "Double" },
]
const firstLines = [
  { value: "firstline:0", label: "No special indent" },
  { value: "firstline:360", label: "First line 0.25 in" },
  { value: "firstline:720", label: "First line 0.5 in" },
  { value: "hanging:360", label: "Hanging 0.25 in" },
  { value: "hanging:720", label: "Hanging 0.5 in" },
]
export function RichTextParagraphGroup({
  editor,
  formatting,
  disabled,
  choose,
}: {
  editor: TextEditor | null
  formatting: TextFormatting | null
  disabled: boolean
  choose: (patch: Parameters<TextEditor["formatParagraph"]>[0]) => void
}) {
  const Alignment =
    alignments.find((choice) => choice.value === formatting?.alignment)?.Icon ??
    AlignLeft
  const start = Number(formatting?.start ?? 0) * 1440
  const indent = (delta: number) =>
    choose({ start: Math.max(0, Math.min(2880, start + delta)) })
  return (
    <div
      role="group"
      aria-label="Paragraph formatting"
      className="flex flex-wrap items-center gap-1"
    >
      <ToolbarChoice
        label="Alignment (Ctrl+Shift+L/E/R/J)"
        value={formatting?.alignment ?? null}
        choices={[...alignments]}
        icon={<Alignment />}
        disabled={disabled}
        editor={editor}
        onChange={(value) => {
          const choice = alignments.find((choice) => choice.value === value)
          if (choice) choose({ alignment: choice.value })
        }}
      />
      <ToolbarChoice
        label="Line spacing"
        value={formatting?.lineSpacing ?? null}
        choices={spacings}
        icon={<ArrowDownWideNarrow />}
        fallback={(value) =>
          value.includes("pt")
            ? value
            : `${Number(value).toLocaleString()} lines`
        }
        disabled={disabled}
        editor={editor}
        onChange={(value) =>
          choose({ lineSpacing: { kind: "multiple", value: Number(value) } })
        }
      />
      <ToolbarButton
        label="Decrease indent (Ctrl+[)"
        disabled={disabled || start <= 0}
        onClick={() => indent(-360)}
      >
        <IndentDecrease />
      </ToolbarButton>
      <ToolbarButton
        label="Increase indent (Ctrl+])"
        disabled={disabled || start >= 2880}
        onClick={() => indent(360)}
      >
        <IndentIncrease />
      </ToolbarButton>
      <ToolbarChoice
        label="Special indent"
        value={formatting?.indent ?? null}
        choices={firstLines}
        icon={
          formatting?.indent?.startsWith("hanging") ? (
            <ListStart />
          ) : (
            <WrapText />
          )
        }
        fallback={(value) => {
          const [kind, amount] = value.split(":")
          return `${kind === "hanging" ? "Hanging" : "First line"} ${(Number(amount) / 1440).toLocaleString(undefined, { maximumFractionDigits: 2 })} in`
        }}
        disabled={disabled}
        editor={editor}
        onChange={(value) => {
          const [kind, amount] = value.split(":")
          if (kind === "firstline" || kind === "hanging")
            choose({ indent: { kind, value: Number(amount) } })
        }}
      />
    </div>
  )
}
