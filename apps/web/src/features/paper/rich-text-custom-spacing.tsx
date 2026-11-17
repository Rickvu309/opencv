import { useId, useReducer, useRef } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  ToolbarButton,
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

type LineKind = NonNullable<TextFormatting["lineKind"]>
const lineKinds = [
  { value: "multiple", label: "Multiple (lines)" },
  { value: "exact", label: "Exactly (pt)" },
  { value: "atleast", label: "At least (pt)" },
]

function SpacingForm({
  editor,
  initial,
  disabled,
  close,
}: {
  editor: TextEditor
  initial: TextFormatting
  disabled: boolean
  close: () => void
}) {
  const id = useId()
  const dirty = useRef(new Set<string>())
  const [kind, setKind] = useReducer(
    (_: LineKind | null, next: LineKind | null) => next,
    initial.lineKind
  )
  const [error, setError] = useReducer((_: string, next: string) => next, "")
  const fields = [
    {
      name: "size",
      label: "Text size (pt)",
      value: initial.size,
      min: 4,
      max: 144,
      step: 0.5,
    },
    {
      name: "before",
      label: "Space before (pt)",
      value: initial.before,
      min: 0,
      max: 1584,
      step: 0.05,
    },
    {
      name: "after",
      label: "Space after (pt)",
      value: initial.after,
      min: 0,
      max: 1584,
      step: 0.05,
    },
  ]
  return (
    <form
      className="grid min-w-0 gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        const data = new FormData(event.currentTarget)
        const patch: Parameters<TextEditor["formatTypography"]>[0] = {}
        for (const name of ["size", "before", "after"] as const) {
          const value = data.get(name)
          if (
            dirty.current.has(name) &&
            typeof value === "string" &&
            value.trim()
          )
            patch[name] = Math.round(Number(value) * 20)
        }
        const line = data.get("lineValue")
        if (
          kind &&
          dirty.current.has("lineValue") &&
          typeof line === "string" &&
          line.trim()
        )
          patch.lineSpacing =
            kind === "multiple"
              ? { kind, value: Number(line) }
              : { kind, value: Math.round(Number(line) * 20) }
        try {
          editor.formatTypography(patch)
          close()
        } catch {
          setError(
            "Paper couldn't apply these values. Your document is kept. Try again."
          )
        }
      }}
    >
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        Text size: 4–144 pt in half points. Paragraph spacing: 0–1584 pt. Mixed
        fields stay unchanged until edited.
      </p>
      {fields.map((field) => (
        <div key={field.name} className="grid min-w-0 gap-2">
          <Label htmlFor={`${id}-${field.name}`}>{field.label}</Label>
          <Input
            id={`${id}-${field.name}`}
            name={field.name}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            defaultValue={field.value ?? ""}
            placeholder="Mixed"
            aria-describedby={`${id}-hint`}
            disabled={disabled}
            onChange={() => dirty.current.add(field.name)}
            className="h-11 text-base tabular-nums"
          />
        </div>
      ))}
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${id}-line-kind`}>Line spacing</Label>
        <Select
          value={kind}
          items={lineKinds}
          disabled={disabled}
          onValueChange={(value) => {
            if (
              value !== "multiple" &&
              value !== "exact" &&
              value !== "atleast"
            )
              return
            setKind(value)
            dirty.current.add("lineValue")
          }}
        >
          <SelectTrigger
            id={`${id}-line-kind`}
            className="h-11 w-full text-base"
          >
            <SelectValue placeholder="Mixed" />
          </SelectTrigger>
          <SelectContent>
            {lineKinds.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${id}-line-value`}>
          {kind === "multiple" ? "Line spacing (lines)" : "Line spacing (pt)"}
        </Label>
        <Input
          key={kind}
          id={`${id}-line-value`}
          name="lineValue"
          type="number"
          min={kind === "multiple" ? 0.5 : 1}
          max={kind === "multiple" ? 10 : 1584}
          step="0.05"
          defaultValue={
            kind === initial.lineKind ? (initial.lineValue ?? "") : ""
          }
          placeholder="Mixed"
          disabled={disabled || !kind}
          required={kind !== initial.lineKind}
          onChange={() => dirty.current.add("lineValue")}
          className="h-11 text-base tabular-nums"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={close}
        >
          Cancel
        </Button>
        <Button type="submit" className="min-h-11" disabled={disabled}>
          Apply
        </Button>
      </DialogFooter>
    </form>
  )
}

export function RichTextCustomSpacing({
  editor,
  formatting,
  disabled,
  onAction,
}: {
  editor: TextEditor | null
  formatting: TextFormatting | null
  disabled: boolean
  onAction: () => void
}) {
  const [initial, setInitial] = useReducer(
    (_: TextFormatting | null, next: TextFormatting | null) => next,
    null
  )
  const selection =
    useRef<ReturnType<TextEditor["captureSelection"]>>(undefined)
  const close = () => {
    setInitial(null)
    onAction()
  }
  return (
    <>
      <ToolbarButton
        label="Size and spacing"
        disabled={disabled}
        onClick={() => {
          selection.current = editor?.captureSelection()
          setInitial(formatting)
        }}
      >
        <SlidersHorizontal />
      </ToolbarButton>
      <Dialog
        open={initial !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent finalFocus={() => editor?.focus() ?? false}>
          <DialogHeader>
            <DialogTitle>Size and spacing</DialogTitle>
            <DialogDescription>
              Set exact values for the selected text and paragraphs.
            </DialogDescription>
          </DialogHeader>
          {initial && editor ? (
            <SpacingForm
              editor={editor}
              initial={initial}
              disabled={disabled}
              close={() => {
                editor.restoreSelection(selection.current)
                close()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
