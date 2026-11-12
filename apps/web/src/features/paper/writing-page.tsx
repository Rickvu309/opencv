import { useCallback, useEffect, useReducer, useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import { paperIdSchema } from "@workspace/domain"

import { Button, buttonVariants } from "@workspace/ui/components/button"

import {
  draftFromPage,
  forgetDraft,
  loadDraft,
  loadDraftBasis,
  subscribeStoredDraft,
  type WritingDraft,
} from "@/features/paper-page/canvas-edit.ts"
import { pageWords } from "@/features/paper-page/canvas-save.ts"
import { WritingCanvas } from "@/features/paper-page/canvas.tsx"
import { readWordPage } from "@/features/paper-page/package-read.ts"
import { WritingProposalCard } from "@/features/paper/writing-proposal.tsx"
import { apiBaseUrl } from "@/lib/api-url.ts"
import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"
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

function savedRevision(docId: string) {
  const draft = loadDraft(docId, localStorage)
  const basis = loadDraftBasis(docId, localStorage)
  if (!draft || !basis?.revision) return null
  return pageWords(draft.blocks) === basis.words ? basis.revision : null
}

export const DOWNLOAD_WAITS_FOR_SAVE =
  "Download Word is ready once your words are saved."

function DownloadWord({ docId, owner }: { docId: string; owner: string }) {
  const revision = useSyncExternalStore(
    subscribeStoredDraft,
    () => savedRevision(docId),
    () => null
  )
  return (
    <div
      data-slot="writing-download"
      className="flex h-10 shrink-0 items-center justify-end gap-3 px-4"
    >
      {revision === null ? (
        <HeldDownload docId={docId} reason={DOWNLOAD_WAITS_FOR_SAVE} />
      ) : (
        <SavedDownload
          key={revision}
          docId={docId}
          owner={owner}
          revision={revision}
        />
      )}
    </div>
  )
}

function HeldDownload({
  docId,
  reason,
}: {
  docId: string
  reason: string | null
}) {
  const described = `${docId}-download`
  return (
    <>
      {reason ? (
        <p className="text-sm text-muted-foreground" id={described}>
          {reason}
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        disabled
        aria-describedby={reason ? described : undefined}
        className="h-11 md:h-8"
      >
        Download Word
      </Button>
    </>
  )
}

function SavedDownload({
  docId,
  owner,
  revision,
}: {
  docId: string
  owner: string
  revision: string
}) {
  const download = useQuery({
    ...catalogClient.options(owner, "paper.export", { docId, at: revision }),
    enabled: owner !== "",
    retry: false,
  })
  if (!download.data) {
    return (
      <HeldDownload
        docId={docId}
        reason={download.error ? "Could not prepare this Word download." : null}
      />
    )
  }
  return (
    <a
      href={`${apiBaseUrl}${download.data.downloadPath}`}
      download={download.data.name}
      className={buttonVariants({
        variant: "ghost",
        className: "h-11 md:h-8",
      })}
    >
      Download Word
    </a>
  )
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
    const data = await readWordPage(
      owner,
      id.data,
      new AbortController().signal
    )
    if (unsent(docId)) {
      setWritingConflict(docId)
      return
    }
    if (!data) throw new Error("Could not read this page.")
    const next = draftFromPage(data)
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
      <DownloadWord docId={docId} owner={owner} />
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
