import { useReducer } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { paperIdSchema } from "@workspace/domain"

import {
  draftFromRegions,
  forgetDraft,
  type WritingDraft,
} from "@/features/paper-page/canvas-edit.ts"
import { WritingCanvas } from "@/features/paper-page/canvas.tsx"
import { WritingProposalCard } from "@/features/paper/writing-proposal.tsx"
import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"

type PageState = {
  generation: number
  seed: WritingDraft | null | undefined
}

type PageEvent = { type: "reread"; seed: WritingDraft }

function pageReducer(state: PageState, event: PageEvent): PageState {
  return { generation: state.generation + 1, seed: event.seed }
}

export function WritingPage({
  docId,
  seed = null,
}: {
  docId: string
  seed?: WritingDraft | null
}) {
  const queryClient = useQueryClient()
  const session = authClient.useSession()
  const owner = session.data?.user.id ?? ""
  const [shown, dispatch] = useReducer(pageReducer, {
    generation: 0,
    seed: undefined,
  })

  async function applied() {
    const id = paperIdSchema.safeParse(docId)
    if (!id.success || owner === "") {
      throw new Error("Could not read this page.")
    }
    const data = await queryClient.fetchQuery(
      catalogClient.options(owner, "paper.read", { docId: id.data })
    )
    const next =
      data && typeof data === "object" && "regions" in data
        ? draftFromRegions(data.regions)
        : null
    if (!next) throw new Error("Could not read this page.")
    forgetDraft(docId, localStorage)
    dispatch({ type: "reread", seed: next })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WritingProposalCard docId={docId} onApplied={applied} />
      <div className="min-h-0 flex-1">
        <WritingCanvas
          key={`${docId}:${shown.generation}`}
          docId={docId}
          seed={shown.seed === undefined ? seed : shown.seed}
        />
      </div>
    </div>
  )
}
