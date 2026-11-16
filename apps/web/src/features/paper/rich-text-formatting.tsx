import { useEffect, useReducer, type ReactNode } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  richTextColors,
  richTextHighlights,
  type mountRichPaperEditor,
} from "@workspace/paper-crdt/editor"

type Editor = ReturnType<typeof mountRichPaperEditor>
type Formatting = ReturnType<Editor["activeFormatting"]>
type Choice = {
  value: string
  label: string
  color?: string
  disabled?: boolean
}

const colors: Choice[] = richTextColors
const highlights: Choice[] = richTextHighlights
const fonts: Choice[] = [
  { value: "default", label: "Default" },
  { value: "liberation-sans", label: "Liberation Sans" },
  { value: "liberation-serif", label: "Liberation Serif" },
  { value: "liberation-mono", label: "Liberation Mono" },
]
const sizes: Choice[] = [
  { value: "default", label: "Default" },
  ...[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((size) => ({
    value: String(size),
    label: `${size} pt`,
  })),
]
const alignments = ["left", "center", "right", "justify"] as const
const alignmentChoices = alignments.map((value) => ({
  value,
  label:
    value === "justify"
      ? "Justified"
      : value.charAt(0).toUpperCase() + value.slice(1),
}))
const lineSpacings: Choice[] = [
  ...[1, 1.15, 1.5, 2, 2.5, 3].map((value) => ({
    value: String(value),
    label: String(value),
  })),
]
const indents = [0, 0.25, 0.5, 0.75, 1, 1.5, 2].map((value) => ({
  value: String(value),
  label: value === 0 ? "None" : `${value} in`,
}))
const firstLines = [
  { value: "firstline:0", label: "None" },
  { value: "firstline:360", label: "First 0.25 in" },
  { value: "firstline:720", label: "First 0.5 in" },
  { value: "hanging:360", label: "Hang 0.25 in" },
  { value: "hanging:720", label: "Hang 0.5 in" },
]
function FormatChoice({
  label,
  value,
  choices,
  disabled,
  onChange,
}: {
  label: string
  value: string | null
  choices: Choice[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const options =
    value && !choices.some((choice) => choice.value === value)
      ? [
          ...choices,
          {
            value,
            label: value === "default" ? "Default" : value,
            disabled: true,
          },
        ]
      : choices
  return (
    <Select
      value={value}
      items={options}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onChange(next)
      }}
    >
      <SelectTrigger
        aria-label={label}
        title={label}
        className="min-h-11 shrink-0 md:min-h-8"
      >
        <SelectValue placeholder="Mixed" />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((choice) => (
          <SelectItem
            key={choice.value}
            value={choice.value}
            disabled={choice.disabled}
          >
            {choice.color ? (
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-sm border"
                style={{ backgroundColor: choice.color }}
              />
            ) : null}
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function RichPaperTextFormatting({
  editor,
  blocked,
  children,
}: {
  editor: Editor | null
  blocked: boolean
  children: ReactNode
}) {
  const [formatting, update] = useReducer(
    (_: Formatting | null, next: Formatting | null) => next,
    null
  )
  useEffect(() => {
    update(editor?.activeFormatting() ?? null)
    return editor?.subscribe(() => update(editor.activeFormatting()))
  }, [editor])
  const disabled = !editor || blocked || !formatting?.hasText
  const inline = (patch: Parameters<Editor["formatInline"]>[0]) =>
    editor?.formatInline(patch)
  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      data-slot="paper-text-formatting"
      className="flex min-w-0 shrink-0 items-center gap-2 overflow-x-auto border-b px-4 py-2"
    >
      <FormatChoice
        label="Font"
        value={formatting?.fontId ?? null}
        choices={fonts}
        disabled={disabled}
        onChange={(fontId) =>
          inline({ fontId: fontId === "default" ? null : fontId })
        }
      />
      <FormatChoice
        label="Text size"
        value={formatting?.size ?? null}
        choices={sizes}
        disabled={disabled}
        onChange={(size) =>
          inline({ size: size === "default" ? null : Number(size) * 20 })
        }
      />
      <div
        role="group"
        aria-label="Text emphasis"
        className="flex shrink-0 items-center gap-1 border-x px-2"
      >
        {children}
      </div>
      <FormatChoice
        label="Text color"
        value={formatting?.color ?? null}
        choices={colors}
        disabled={disabled}
        onChange={(color) =>
          inline({ color: color === "default" ? null : color })
        }
      />
      <FormatChoice
        label="Highlight"
        value={formatting?.highlight ?? null}
        choices={highlights}
        disabled={disabled}
        onChange={(highlight) =>
          inline({ highlight: highlight === "default" ? null : highlight })
        }
      />
      <FormatChoice
        label="Alignment"
        value={formatting?.alignment ?? null}
        choices={alignmentChoices}
        disabled={disabled}
        onChange={(value) => {
          const alignment = alignments.find((alignment) => alignment === value)
          if (alignment) editor?.formatParagraph({ alignment })
        }}
      />
      <FormatChoice
        label="Line spacing"
        value={formatting?.lineSpacing ?? null}
        choices={lineSpacings}
        disabled={disabled}
        onChange={(value) =>
          editor?.formatParagraph({
            lineSpacing: { kind: "multiple", value: Number(value) },
          })
        }
      />
      <FormatChoice
        label="Indent"
        value={formatting?.start ?? null}
        choices={indents}
        disabled={disabled}
        onChange={(value) =>
          editor?.formatParagraph({ start: Number(value) * 1440 })
        }
      />
      <FormatChoice
        label="First line"
        value={formatting?.indent ?? null}
        choices={firstLines}
        disabled={disabled}
        onChange={(value) => {
          const [kind, amount] = value.split(":")
          if (kind === "firstline" || kind === "hanging")
            editor?.formatParagraph({ indent: { kind, value: Number(amount) } })
        }}
      />
    </div>
  )
}
