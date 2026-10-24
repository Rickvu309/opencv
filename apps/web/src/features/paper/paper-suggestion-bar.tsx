import { Button } from "@workspace/ui/components/button"

import {
  SUGGESTION_ACCEPT,
  SUGGESTION_REJECT,
  suggestionSentence,
  type PaperSuggestion,
} from "./paper-suggestion.ts"

type Props = {
  suggestion: PaperSuggestion
  onAccept: () => void
  onReject: () => void
}

export function PaperSuggestionBar({ suggestion, onAccept, onReject }: Props) {
  return (
    <div
      role="status"
      aria-label="Coach suggestion"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/60 px-5 py-2 text-sm"
    >
      <p>{suggestionSentence(suggestion.sections)}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onReject}>
          {SUGGESTION_REJECT}
        </Button>
        <Button type="button" size="sm" onClick={onAccept}>
          {SUGGESTION_ACCEPT}
        </Button>
      </div>
    </div>
  )
}
