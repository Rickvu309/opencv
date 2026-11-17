import { useCallback, useEffect, useReducer } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { paperIdSchema } from "@workspace/domain"

import { ArrowLeft, Download } from "lucide-react"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  PageHeader,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"

import {
  draftFromPage,
  forgetDraft,
  loadDraft,
  loadDraftBasis,
  type WritingDraft,
} from "@/features/paper-page/canvas-edit.ts"
import { pageWords } from "@/features/paper-page/canvas-save.ts"
import { WritingCanvas } from "@/features/paper-page/canvas.tsx"
import { readWordPage } from "@/features/paper-page/package-read.ts"
import { LetterStoppedNotice } from "@/features/paper/paper-letter-stopped.tsx"
import {
  WritingDocumentNoticeSync,
  WritingProposalCard,
} from "@/features/paper/writing-proposal.tsx"
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

export const DOWNLOAD_WAITS_FOR_SAVE =
  "Download Word is ready once your words are saved."

function DownloadWord({
  docId,
  owner,
  revision,
}: {
  docId: string
  owner: string
  revision: string | null
}) {
  return (
    <div
      data-slot="writing-document-export"
      className="flex max-w-full shrink-0 flex-wrap items-center gap-3"
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
  unavailable = false,
}: {
  docId: string
  reason: string | null
  unavailable?: boolean
}) {
  const described = `${docId}-download`
  return (
    <>
      {reason ? (
        <p className="sr-only" id={described}>
          {reason}
        </p>
      ) : null}
      {unavailable ? (
        <span className="text-xs text-muted-foreground" role="alert">
          Download unavailable
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        disabled
        aria-describedby={reason ? described : undefined}
        className="h-11 md:h-8"
        aria-label="Download Word"
      >
        <Download aria-hidden="true" />
        <span className="hidden sm:inline">Download Word</span>
        <span className="sm:hidden">Word</span>
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
        unavailable={download.isError}
      />
    )
  }
  return (
    <a
      href={`${apiBaseUrl}${download.data.downloadPath}`}
      download={download.data.name}
      aria-label="Download Word"
      className={cn(buttonVariants({ variant: "outline" }), "h-11 md:h-8")}
    >
      <Download aria-hidden="true" />
      <span className="hidden sm:inline">Download Word</span>
      <span className="sm:hidden">Word</span>
    </a>
  )
}

function DocumentHeader({
  docId,
  owner,
  title,
  onBack,
  note,
  revision,
}: {
  docId: string
  owner: string
  title: string
  onBack?: () => void
  note: string
  revision: string | null
}) {
  return (
    <PageHeader data-slot="writing-document-header">
      <div className="flex min-w-0 flex-[1_1_8rem] items-center gap-2">
        <a
          href="/paper"
          aria-label="Back to Paper"
          onClick={
            onBack
              ? (event) => {
                  event.preventDefault()
                  onBack()
                }
              : undefined
          }
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "size-11 p-0 md:h-8 md:w-auto md:px-2"
          )}
        >
          <ArrowLeft aria-hidden="true" />
          <span className="hidden md:inline">Paper</span>
        </a>
        <PageHeaderTitle
          className="min-w-0 text-sm leading-5 max-md:min-w-0"
          title={title}
        >
          {title}
        </PageHeaderTitle>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-3">
        <p
          className="writing-note writing-header-status"
          role="status"
          title={note}
        >
          {note === "Saved" ? (
            "Saved"
          ) : (
            <>
              <span aria-hidden="true">Not saved</span>
              <span className="sr-only">{note || "Checking saved words."}</span>
            </>
          )}
        </p>
        <DownloadWord docId={docId} owner={owner} revision={revision} />
      </div>
    </PageHeader>
  )
}

export function WritingPage({
  docId,
  title = "Untitled document",
  onBack,
  seed = null,
  seedRevision = null,
}: {
  docId: string
  title?: string
  onBack?: () => void
  seed?: WritingDraft | null
  seedRevision?: string | null
}) {
  const session = authClient.useSession()
  const owner = session.data?.user.id ?? ""
  const [header, mountHeader] = useReducer(
    (
      _: HTMLDivElement | null,
      event: { type: "mount"; node: HTMLDivElement | null }
    ) => event.node,
    null
  )
  const setHeader = useCallback((node: HTMLDivElement | null) => {
    mountHeader({ type: "mount", node })
  }, [])
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

  const [liveText, updateLiveText] = useReducer(
    (
      state: { docId: string; text: string } | null,
      next: { docId: string; text: string }
    ) =>
      state?.docId === next.docId && state.text === next.text ? state : next,
    null
  )
  const onText = useCallback(
    (text: string) => updateLiveText({ docId, text }),
    [docId]
  )
  const visibleSeed = shown.seed === undefined ? seed : shown.seed
  const pageText =
    liveText?.docId === docId
      ? liveText.text
      : visibleSeed
        ? visibleSeed.blocks.map((block) => block.text).join("\n")
        : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={setHeader} />
      <WritingProposalCard docId={docId}>
        <LetterStoppedNotice docId={docId} pageText={pageText} />
      </WritingProposalCard>
      <div className="min-h-0 flex-1">
        <WritingCanvas
          key={`${docId}:${shown.generation}`}
          docId={docId}
          renderHeader={(note, revision) => (
            <>
              <WritingDocumentNoticeSync docId={docId} onText={onText} />
              {header
                ? createPortal(
                    <DocumentHeader
                      docId={docId}
                      owner={owner}
                      title={title}
                      onBack={onBack}
                      note={note}
                      revision={revision}
                    />,
                    header
                  )
                : null}
            </>
          )}
          seed={visibleSeed}
          seedRevision={
            shown.revision === undefined ? seedRevision : shown.revision
          }
        />
      </div>
    </div>
  )
}
