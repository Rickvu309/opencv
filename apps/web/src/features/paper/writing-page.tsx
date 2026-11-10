import { useCallback, useEffect, useReducer } from "react"
import { paperIdSchema } from "@workspace/domain"

import {
  draftFromRegions,
  forgetDraft,
  loadDraft,
  loadDraftBasis,
  type WritingDraft,
} from "@/features/paper-page/canvas-edit.ts"
import { pageWords } from "@/features/paper-page/canvas-save.ts"
import { WritingCanvas } from "@/features/paper-page/canvas.tsx"
import { readWholePackage } from "@/features/paper-page/package-read.ts"
import { WritingProposalCard } from "@/features/paper/writing-proposal.tsx"
import { authClient } from "@/lib/auth-client.ts"
import {
  setWritingConflict,
  subscribeWritingRefresh,
  writingConflictDoc,
} from "@/lib/writing-refresh.ts"

type PageState = {
  generation: number
  seed: WritingDraft | null | undefined
  revision: string | null | undefined
}

type PageEvent = {
  type: "reread"
  seed: WritingDraft
  revision: string | null
}

function pageReducer(state: PageState, event: PageEvent): PageState {
  return {
    generation: state.generation + 1,
    seed: event.seed,
    revision: event.revision,
  }
}

function unsent(docId: string) {
  const draft = loadDraft(docId, localStorage)
  const basis = loadDraftBasis(docId, localStorage)
  if (!draft || !basis) return false
  return pageWords(draft.blocks) !== basis.words
}

export function WritingPage({
  docId,
  seed = null,
  seedRevision = null,
}: {
  docId: string
  seed?: WritingDraft | null
  seedRevision?: string | null
}) {
  const session = authClient.useSession()
  const owner = session.data?.user.id ?? ""
  const [shown, dispatch] = useReducer(pageReducer, {
    generation: 0,
    seed: undefined,
    revision: undefined,
  })

  const applied = useCallback(async () => {
    if (unsent(docId)) {
      setWritingConflict(docId)
      return
    }
    const id = paperIdSchema.safeParse(docId)
    if (!id.success || owner === "") {
      throw new Error("Could not read this page.")
    }
    const data = await readWholePackage(
      owner,
      id.data,
      new AbortController().signal
    )
    if (unsent(docId)) {
      setWritingConflict(docId)
      return
    }
    if (!data) throw new Error("Could not read this page.")
    const next = draftFromRegions(data.regions)
    if (!next) throw new Error("Could not read this page.")
    forgetDraft(docId, localStorage)
    setWritingConflict(null)
    dispatch({ type: "reread", seed: next, revision: data.revision })
  }, [docId, owner])

  useEffect(
    () =>
      subscribeWritingRefresh(() => {
        void applied().catch(() => undefined)
      }),
    [applied]
  )
  useEffect(
    () => () => {
      if (writingConflictDoc() === docId) setWritingConflict(null)
    },
    [docId]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WritingProposalCard docId={docId} onApplied={applied} />
      <div className="min-h-0 flex-1">
        <WritingCanvas
          key={`${docId}:${shown.generation}`}
          docId={docId}
          seed={shown.seed === undefined ? seed : shown.seed}
          seedRevision={
            shown.revision === undefined ? seedRevision : shown.revision
          }
        />
      </div>
    </div>
  )
}
