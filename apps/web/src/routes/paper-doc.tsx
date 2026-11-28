import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useEffect, useReducer } from "react"
import { toast } from "sonner"

import {
  ERROR_CODES,
  catalog,
  paperIdSchema,
  parsePaperId,
} from "@workspace/domain/kernel"
import { type Document } from "@workspace/domain/paper-doc"

import { Button } from "@workspace/ui/components/button"

import {
  PaperChrome,
  type ChromeSync,
} from "@/features/paper/editor/chrome/paper-chrome.tsx"
import { validatePaperSearch } from "@/features/paper/paper-templates.ts"
import { ApiError } from "@/lib/api-error.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import {
  downloadEnginePaper,
  openEnginePaperPdf,
} from "@/lib/paper-engine-download.ts"
import { usePaperSuggestions } from "@/lib/paper-suggestions.ts"
import { openPaperSync } from "@/lib/paper-sync.ts"
import { browserSyncPorts } from "@/lib/paper-sync-ports.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { holdWritingCoachFocus } from "@/lib/writing-coach-focus.ts"
import { loadedSessionCheck } from "@/lib/session-check.ts"
import { qualifiedPaperRead } from "@/lib/paper-qualification.ts"

const PAPER_PREFIX = `${SURFACE_PATHS.paper}/`
const NOT_FOUND = "Document not found."

function docIdFromPath(pathname: string) {
  if (!pathname.startsWith(PAPER_PREFIX)) return ""
  return decodeURIComponent(
    pathname.slice(PAPER_PREFIX.length).split("/")[0] ?? ""
  )
}

type PaperState =
  | { kind: "opening" }
  | {
      kind: "open"
      docId: string
      title: string
      doc: Document
      sync: ChromeSync
    }
  | { kind: "failed"; message: string; retry: boolean }

type PaperAction = { type: "opened"; state: PaperState }

function paperReducer(_state: PaperState, action: PaperAction): PaperState {
  return action.state
}

const olderFormat: PaperState = {
  kind: "failed",
  message: "This document cannot be opened in Paper.",
  retry: false,
}

async function openSavedPaper(
  queryClient: QueryClient,
  docId: string
): Promise<PaperState> {
  const check = await loadedSessionCheck()
  if (check.kind !== "signed-in")
    return {
      kind: "failed",
      message: "Sign in to open this Paper",
      retry: false,
    }
  const ownerId = check.session.user.id
  const sessionId = check.session.session.id
  const info = await qualifiedPaperRead(
    catalog["paper.read"].name,
    parsePaperId(docId),
    { ownerId, sessionId }
  )
  if (info.format !== "rich") return olderFormat
  const metadata = await catalogClient.read(catalog["paper.read"].name, {
    docId,
    view: "engine",
  })
  if (!("doc" in metadata)) return olderFormat
  const paper = await openPaperSync(docId, browserSyncPorts(docId, queryClient))
  return {
    kind: "open",
    docId,
    title: metadata.name,
    doc: paper.doc,
    sync: { paper, actor: check.session.user.id },
  }
}

type OpenPaper = Extract<PaperState, { kind: "open" }>

function OpenedPaper({ paper }: { paper: OpenPaper }) {
  const queryClient = useQueryClient()
  const openedId = paper.docId
  const onEditor = usePaperSuggestions(
    openedId,
    paper.sync.actor,
    paper.sync.paper
  )
  return (
    <main aria-label="Paper">
      <PaperChrome
        doc={paper.doc}
        title={paper.title}
        sync={paper.sync}
        photoReason="Needs a saved photo"
        onEditor={onEditor}
        download={{
          start: (format: "word" | "pdf") => {
            void downloadEnginePaper(
              queryClient,
              openedId,
              format === "word" ? "docx" : "pdf"
            ).catch(() =>
              toast.error("Paper could not download this file. Try again.")
            )
          },
        }}
        onPrint={() => {
          void openEnginePaperPdf(queryClient, openedId).catch(() =>
            toast.error("Paper could not open the PDF. Try again.")
          )
        }}
      />
    </main>
  )
}

function openFailure(error: unknown): PaperState {
  if (error instanceof ApiError && error.code === ERROR_CODES.NOT_FOUND)
    return { kind: "failed", message: NOT_FOUND, retry: false }
  return {
    kind: "failed",
    message: "Could not open this document.",
    retry: true,
  }
}

export function PaperDocPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const routeSearch = useRouterState({
    select: (state) => state.location.search,
  })
  const search = validatePaperSearch(routeSearch)
  const parsedId = paperIdSchema.safeParse(docIdFromPath(pathname))
  const docId = parsedId.success ? parsedId.data : null
  const [paper, dispatch] = useReducer(paperReducer, { kind: "opening" })
  const [attempt, retry] = useReducer((count: number) => count + 1, 0)

  useEffect(
    () => (docId === null ? undefined : holdWritingCoachFocus(docId)),
    [docId]
  )
  useEffect(() => {
    if (docId === null) return
    let alive = true
    let opened: PaperState | null = null
    dispatch({ type: "opened", state: { kind: "opening" } })
    openSavedPaper(queryClient, docId)
      .then((state) => {
        opened = state
        if (alive) dispatch({ type: "opened", state })
        else if (state.kind === "open") state.sync.paper.close()
      })
      .catch((error: unknown) => {
        if (alive) dispatch({ type: "opened", state: openFailure(error) })
      })
    return () => {
      alive = false
      if (opened?.kind === "open") opened.sync.paper.close()
    }
  }, [queryClient, docId, attempt])

  const back = () => void navigate({ to: SURFACE_PATHS.paper, search })
  if (docId === null || paper.kind === "failed")
    return (
      <section
        aria-label="Paper"
        className="flex flex-col items-start gap-3 p-4"
      >
        <p role="alert">
          {docId === null
            ? NOT_FOUND
            : paper.kind === "failed"
              ? paper.message
              : NOT_FOUND}
        </p>
        {paper.kind === "failed" && paper.retry ? (
          <Button onClick={retry}>Try again</Button>
        ) : null}
        <Button variant="outline" onClick={back}>
          Paper
        </Button>
      </section>
    )
  if (paper.kind === "opening")
    return <main aria-label="Paper" aria-busy="true" />
  return <OpenedPaper key={paper.docId} paper={paper} />
}
