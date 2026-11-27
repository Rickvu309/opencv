import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useEffect, useReducer } from "react"

import { catalog } from "@workspace/domain/kernel"
import type { AgentCommand } from "@workspace/domain/paper-doc"

import { catalogClient, undoActivity } from "@/lib/contract-client.ts"
import type { PaperSync } from "@/lib/paper-sync.ts"

type SuggestionReceipt = { undo?: () => Promise<void> }

type SuggestionTarget = {
  suggest(
    proposals: { id: string; commands: AgentCommand[] }[],
    port: {
      approve(id: string, batch: string): Promise<SuggestionReceipt>
      deny(id: string): Promise<void>
    }
  ): void
}

const SUGGESTIONS = catalog["paper.suggestions"].name

export function refreshPaperSuggestions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "catalog" && query.queryKey[2] === SUGGESTIONS,
  })
}

function suggestionPort(queryClient: QueryClient, sync: PaperSync) {
  return {
    async approve(
      pendingActionId: string,
      batch: string
    ): Promise<SuggestionReceipt> {
      sync.accepting(pendingActionId, batch)
      const receipt = await catalogClient.run(
        queryClient,
        catalog["actions.approve"].name,
        { pendingActionId }
      )
      const activityId =
        receipt && "id" in receipt && typeof receipt.id === "string"
          ? receipt.id
          : null
      if (!activityId) return {}
      return {
        undo: async () => {
          await undoActivity(queryClient, activityId)
        },
      }
    },
    async deny(pendingActionId: string) {
      await catalogClient.run(queryClient, catalog["actions.deny"].name, {
        pendingActionId,
      })
      await refreshPaperSuggestions(queryClient)
    },
  }
}

function targetReducer(
  _current: SuggestionTarget | null,
  next: SuggestionTarget | null
) {
  return next
}

export function usePaperSuggestions(
  docId: string,
  ownerId: string,
  sync: PaperSync
) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useReducer(targetReducer, null)
  const read = catalogClient.useRead(ownerId, SUGGESTIONS, { docId })
  const suggestions = read.data?.suggestions
  useEffect(() => {
    if (!target || !suggestions) return
    target.suggest(suggestions, suggestionPort(queryClient, sync))
  }, [target, suggestions, queryClient, sync])
  return setTarget
}
