import { useCallback, useState } from "react"
import type { DiffHunk } from "@workspace/domain"

import {
  addSuggestion,
  logSuggestion,
  type PaperSuggestion,
  type SuggestionEntry,
} from "./paper-suggestion.ts"

/** The open Coach suggestion and the decisions made on earlier ones. */
export function usePaperSuggestion() {
  const [suggestion, setSuggestion] = useState<PaperSuggestion | null>(null)
  const [log, setLog] = useState<SuggestionEntry[]>([])

  const add = useCallback((previous: unknown, hunks: readonly DiffHunk[]) => {
    setSuggestion((current) => addSuggestion(current, previous, hunks))
  }, [])

  const clear = useCallback((resetLog = false) => {
    setSuggestion(null)
    if (resetLog) setLog([])
  }, [])

  function decide(outcome: "kept" | "undone") {
    if (!suggestion) return null
    setLog((entries) => logSuggestion(entries, suggestion, outcome, Date.now()))
    setSuggestion(null)
    return suggestion
  }

  return {
    suggestion,
    log,
    add,
    clear,
    keep: () => decide("kept"),
    undo: () => decide("undone"),
  }
}
