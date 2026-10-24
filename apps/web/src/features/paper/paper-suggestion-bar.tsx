import { Button } from "@workspace/ui/components/button"

import {
  SUGGESTION_KEEP,
  SUGGESTION_UNDO,
  suggestionSentence,
  type PaperSuggestion,
} from "./paper-suggestion.ts"

type Props = {
  suggestion: PaperSuggestion
  onKeep: () => void
  onUndo: () => void
}

export function PaperSuggestionBar({ suggestion, onKeep, onUndo }: Props) {
  return (
    <div
      role="status"
      aria-label="Coach suggestion"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/60 px-5 py-2 text-sm"
    >
      <p>{suggestionSentence(suggestion.sections)}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onUndo}>
          {SUGGESTION_UNDO}
        </Button>
        <Button type="button" size="sm" onClick={onKeep}>
          {SUGGESTION_KEEP}
        </Button>
      </div>
    </div>
  )
}
