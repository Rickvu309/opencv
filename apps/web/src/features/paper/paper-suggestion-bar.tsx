import { Suspense, lazy, useMemo, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
} from "@workspace/ui/components/item"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

import {
  SUGGESTION_KEEP,
  SUGGESTION_UNDO,
  suggestionNotes,
  suggestionSentence,
  type PaperSuggestion,
  type SuggestionEntry,
} from "./paper-suggestion.ts"

const SuggestionThread = lazy(() => import("./paper-suggestion-thread.tsx"))

type Props = {
  suggestion: PaperSuggestion
  log: readonly SuggestionEntry[]
  onKeep: () => void
  onUndo: () => void
}

export function PaperSuggestionBar({ suggestion, log, onKeep, onUndo }: Props) {
  const [openedAt] = useState(() => Date.now())
  const notes = useMemo(
    () => suggestionNotes(log, suggestion, openedAt),
    [log, suggestion, openedAt]
  )
  const messages = notes.map((note) => ({
    id: note.id,
    createdAt: note.at,
    text: note.text,
    status: note.status,
    details: note.details,
  }))

  return (
    <Item
      variant="muted"
      size="sm"
      role="status"
      aria-label="Coach suggestion"
      className="rounded-none border-0 border-b border-border px-5"
    >
      <ItemContent>
        <ItemDescription className="text-sm text-foreground">
          {suggestionSentence(suggestion.sections)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Popover>
          <PopoverTrigger
            render={<Button type="button" size="sm" variant="ghost" />}
          >
            What changed
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(26rem,calc(100vw-2rem))] border-0 bg-transparent p-0 shadow-none ring-0"
          >
            <Suspense fallback={null}>
              <SuggestionThread
                key={`${log.length}:${suggestion.sections.join("|")}`}
                messages={messages}
              />
            </Suspense>
          </PopoverContent>
        </Popover>
        <Button type="button" size="sm" variant="outline" onClick={onUndo}>
          {SUGGESTION_UNDO}
        </Button>
        <Button type="button" size="sm" onClick={onKeep}>
          {SUGGESTION_KEEP}
        </Button>
      </ItemActions>
    </Item>
  )
}
