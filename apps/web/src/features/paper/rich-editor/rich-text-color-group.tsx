import { useReducer } from "react"
import { Baseline, Highlighter, PaintBucket, Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "@workspace/ui/components/popover"
import {
  ToolbarHint,
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

import { ToolbarItem, useToolbarGroup } from "./rich-text-toolbar-item.tsx"

type Swatch = { value: string; label: string; color?: string }
function ColorChoice({
  label,
  value,
  choices,
  disabled,
  editor,
  onChange,
  highlight = false,
}: {
  label: string
  value: string | null
  choices: Swatch[]
  disabled: boolean
  editor: TextEditor | null
  onChange: (value: string) => void
  highlight?: boolean
}) {
  const [open, dispatch] = useReducer(
    (_: boolean, action: { type: "open"; open: boolean }) => action.open,
    false
  )
  const setOpen = (open: boolean) => dispatch({ type: "open", open })
  const selected = choices.find(
    (choice) =>
      choice.value === value ||
      (choice.value === "default" && choice.color === value)
  )
  const color = selected?.color ?? (value !== "default" ? value : undefined)
  const Icon = highlight ? Highlighter : Baseline
  return (
    <ToolbarItem label={label}>
      <Popover open={open} onOpenChange={setOpen}>
        <ToolbarHint
          label={`${label}: ${disabled ? "Unavailable" : value === null ? "Mixed" : (selected?.label ?? "Custom color")}`}
        >
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:size-8"
                aria-label={label}
                disabled={disabled}
              />
            }
          >
            <span className="flex flex-col items-center gap-0.5">
              <Icon
                className="size-4"
                style={highlight ? { fill: color ?? "transparent" } : undefined}
              />
              <span
                aria-hidden="true"
                data-slot="current-color"
                className="h-1 w-5 rounded-sm border border-foreground/20"
                style={{ backgroundColor: color ?? "transparent" }}
              />
            </span>
          </PopoverTrigger>
        </ToolbarHint>
        <PopoverContent
          aria-label={label}
          className="w-64"
          align="start"
          finalFocus={() => editor?.focus() ?? false}
        >
          <PopoverTitle>{label}</PopoverTitle>
          <div
            role="group"
            aria-label={`${label} palette`}
            className="grid grid-cols-3 gap-2"
          >
            {choices.map((choice) => (
              <Button
                key={choice.value}
                variant={
                  selected?.value === choice.value ? "secondary" : "ghost"
                }
                className="h-auto min-h-11 flex-col gap-1 p-2"
                aria-label={choice.label}
                aria-pressed={selected?.value === choice.value}
                onClick={() => {
                  onChange(choice.value)
                  setOpen(false)
                }}
              >
                <span
                  className="flex size-6 items-center justify-center rounded-sm border border-foreground/30"
                  style={{ backgroundColor: choice.color }}
                >
                  {selected?.value === choice.value ? (
                    <Check
                      className="size-4"
                      style={{
                        color: choice.color
                          ? highlight
                            ? "black"
                            : "white"
                          : "currentColor",
                      }}
                    />
                  ) : !choice.color ? (
                    <PaintBucket className="size-3" />
                  ) : null}
                </span>
                <span className="text-xs">{choice.label}</span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </ToolbarItem>
  )
}
export function RichTextColorGroup({
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
  const group = useToolbarGroup(["Text color", "Highlight"])
  return (
    <div
      {...group}
      role="group"
      aria-label="Text colors"
      className="flex items-center gap-1"
    >
      <ColorChoice
        label="Text color"
        value={formatting?.color ?? null}
        choices={editor?.formattingOptions.colors ?? []}
        disabled={disabled}
        editor={editor}
        onChange={(color) =>
          choose({ color: color === "default" ? null : color })
        }
      />
      <ColorChoice
        label="Highlight"
        value={formatting?.highlight ?? null}
        choices={editor?.formattingOptions.highlights ?? []}
        disabled={disabled}
        editor={editor}
        highlight
        onChange={(highlight) =>
          choose({ highlight: highlight === "default" ? null : highlight })
        }
      />
    </div>
  )
}
