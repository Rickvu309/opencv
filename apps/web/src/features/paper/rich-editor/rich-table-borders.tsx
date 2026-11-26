import { resolveTableBorders } from "@workspace/domain/internal/paper-presentation"
import { Button } from "@workspace/ui/components/button"
import { Check } from "lucide-react"
import type { TextEditor } from "./rich-text-toolbar-control.tsx"

type Borders = Parameters<TextEditor["setTableBorders"]>[0]
const modes = [
  { value: "none", label: "No borders" },
  { value: "all", label: "All borders" },
  { value: "outer", label: "Outer border" },
] satisfies { value: Borders["mode"]; label: string }[]
const weights = ["thin", "medium"] satisfies Borders["weight"][]

export function RichTableBorders({
  editor,
  borders,
  onError,
}: {
  editor: TextEditor
  borders: Borders | undefined
  onError: (message: string) => void
}) {
  const current: Borders = borders ?? {
    mode: "all",
    color: resolveTableBorders(undefined).color,
    weight: "thin",
  }
  const choose = (patch: Partial<Borders>) => {
    try {
      editor.setTableBorders({ ...current, ...patch })
      onError("")
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Table borders could not change"
      )
    }
  }
  return (
    <div className="grid gap-3 border-b pb-3" data-slot="table-borders">
      <div role="group" aria-label="Table borders" className="grid gap-1">
        {modes.map(({ value, label }) => (
          <Button
            key={value}
            variant={current.mode === value ? "secondary" : "ghost"}
            className="min-h-11 justify-start"
            aria-pressed={current.mode === value}
            onClick={() => choose({ mode: value })}
          >
            {label}
            {current.mode === value && (
              <Check aria-hidden="true" className="ml-auto size-4" />
            )}
          </Button>
        ))}
      </div>
      <div
        role="group"
        aria-label="Border weight"
        className="grid grid-cols-2 gap-1"
      >
        {weights.map((weight) => (
          <Button
            key={weight}
            variant={current.weight === weight ? "secondary" : "ghost"}
            className="min-h-11"
            aria-pressed={current.weight === weight}
            onClick={() => choose({ weight })}
          >
            {weight === "thin" ? "Thin" : "Medium"}
            {current.weight === weight && (
              <Check aria-hidden="true" className="size-4" />
            )}
          </Button>
        ))}
      </div>
      <div
        role="group"
        aria-label="Border color"
        className="grid grid-cols-3 gap-1"
      >
        {editor.formattingOptions.colors.map((color) => (
          <Button
            key={color.value}
            variant={current.color === color.value ? "secondary" : "ghost"}
            className="min-h-11 flex-col gap-1 px-1 text-xs"
            aria-label={`${color.label} border`}
            aria-pressed={current.color === color.value}
            onClick={() => choose({ color: color.value })}
          >
            <span
              aria-hidden="true"
              className="size-4 rounded-sm border border-foreground/30"
              style={{ backgroundColor: color.color }}
            />
            <span className="flex items-center gap-1">
              {color.label}
              {current.color === color.value && (
                <Check aria-hidden="true" className="size-3" />
              )}
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}
