import { Pin, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import type { CoachContextChip } from "./coach-context-chips.ts"
import type { ToolbarVariant } from "./paper-editor-toolbar.tsx"

export const REWRITE_SELECTION = "Rewrite selection"

export const QUICK_PROMPTS: Record<ToolbarVariant, string[]> = {
  cv: [
    REWRITE_SELECTION,
    "Sharpen my checkout project bullet",
    "Add a metric to outcome",
    "Tailor for associate PM intern",
    "What should I cut?",
  ],
  proof: [
    REWRITE_SELECTION,
    "Turn this note into an outcome",
    "What screenshot should I add?",
    "Link this to my CV",
  ],
  letter: [
    REWRITE_SELECTION,
    "Make opening stronger",
    "Tie in my checkout Proof",
    "Shorten to half page",
    "Fix tone — less stiff",
  ],
  full: [REWRITE_SELECTION, "Fix spelling", "Make it shorter"],
}

export function SoftScopeChip({
  docName,
  onRemove,
}: {
  docName: string
  onRemove: () => void
}) {
  return (
    <div
      data-coach-soft-scope
      role="status"
      aria-label="In context"
      className="flex min-w-0"
    >
      <div className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-muted/40 py-0.5 pr-0.5 pl-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{docName.trim() || "This CV"}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Remove from context"
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}

export function DurableContextChip({
  chip,
  onPin,
  onRemove,
}: {
  chip: CoachContextChip
  onPin: () => void
  onRemove: () => void
}) {
  const isDoc = chip.kind === "doc"
  return (
    <div
      data-coach-context-chip
      data-kind={chip.kind}
      data-pinned={chip.pinned ? "true" : "false"}
      role="status"
      aria-label={isDoc ? "Attached from Paper" : "Selection in context"}
      className="flex min-w-0"
    >
      <div className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-muted/40 py-0.5 pr-0.5 pl-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {isDoc ? chip.label : `“${chip.label}”`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={chip.pinned ? "Unpin" : "Pin in context"}
          aria-pressed={chip.pinned}
          onClick={onPin}
        >
          <Pin className={chip.pinned ? "fill-current" : undefined} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Remove from context"
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}

export function QuickPromptChips({
  chips,
  turnActive,
  hasSelection,
  onSubmit,
}: {
  chips: readonly string[]
  turnActive: boolean
  hasSelection: boolean
  onSubmit: (text: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => {
        const needsSelection = chip === REWRITE_SELECTION
        const disabled = turnActive || (needsSelection && !hasSelection)
        return (
          <Button
            key={chip}
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onSubmit(chip)}
            disabled={disabled}
            className="h-auto rounded-full px-2 py-0.5 text-xs text-muted-foreground"
          >
            {chip}
          </Button>
        )
      })}
    </div>
  )
}
