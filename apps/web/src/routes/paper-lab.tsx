import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useEffect, useReducer } from "react"
import { toast } from "sonner"

import { catalog } from "@workspace/domain/kernel"
import type { Document } from "@workspace/domain/paper-doc"

import {
  PaperChrome,
  type ChromeSync,
} from "@/features/paper/editor/chrome/paper-chrome.tsx"
import {
  labDocument,
  labSuggestions,
} from "@/features/paper/editor/lab-documents.ts"
import type { PaperEditor } from "@/features/paper/editor/paper-editor.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import {
  downloadEnginePaper,
  openEnginePaperPdf,
} from "@/lib/paper-engine-download.ts"
import { openPaperSync } from "@/lib/paper-sync.ts"
import { browserSyncPorts } from "@/lib/paper-sync-ports.ts"
import { holdWritingCoachFocus } from "@/lib/writing-coach-focus.ts"
import { loadedSessionCheck } from "@/lib/session-check.ts"

declare global {
  interface Window {
    paperLab?: PaperEditor
  }
}

const LAB_DOWNLOAD = { reason: "Save this Paper first to download it" }
const LAB_TITLE = "Paper test page"

function exposeLabEditor(editor: PaperEditor | null) {
  if (!editor) {
    delete window.paperLab
    return
  }
  window.paperLab = editor
  const params = new URLSearchParams(window.location.search)
  if (params.get("suggest") === "coach")
    editor.suggest(labSuggestions(params.get("doc")), {
      approve: () => Promise.resolve(),
      deny: () => Promise.resolve(),
    })
}

type LabState =
  | { kind: "opening" }
  | { kind: "local"; doc: Document }
  | {
      kind: "saved"
      docId: string
      title: string
      doc: Document
      sync: ChromeSync
    }
  | { kind: "failed"; message: string }

type LabAction = { type: "opened"; state: LabState }

function labReducer(_state: LabState, action: LabAction): LabState {
  return action.state
}

let creating: Promise<string> | null = null

async function createSavedCv(queryClient: QueryClient): Promise<string> {
  const created: unknown = await catalogClient.run(
    queryClient,
    "paper.create",
    { kind: "cv", format: "rich", engine: 2 },
    { refresh: false }
  )
  if (
    !created ||
    typeof created !== "object" ||
    !("id" in created) ||
    typeof created.id !== "string"
  )
    throw new Error("The new Paper waits for approval")
  return created.id
}

function newSavedCv(queryClient: QueryClient): Promise<string> {
  creating ??= createSavedCv(queryClient)
  return creating
}

async function openLab(queryClient: QueryClient): Promise<LabState> {
  const params = new URLSearchParams(window.location.search)
  const saved = params.get("paper")
  const name = params.get("doc")
  if (!saved && name !== "blank")
    return { kind: "local", doc: labDocument(name) }
  const check = await loadedSessionCheck()
  if (check.kind !== "signed-in") {
    if (saved) return { kind: "failed", message: "Sign in to open this Paper" }
    return { kind: "local", doc: labDocument(name) }
  }
  const docId: string = saved ?? (await newSavedCv(queryClient))
  let title = LAB_TITLE
  if (saved) {
    const metadata = await catalogClient.read(catalog["paper.read"].name, {
      docId,
      view: "engine",
    })
    if (!("doc" in metadata)) throw new Error("Paper could not be opened.")
    title = metadata.name
  }
  if (!saved) {
    const url = new URL(window.location.href)
    url.searchParams.delete("doc")
    url.searchParams.set("paper", docId)
    window.history.replaceState(window.history.state, "", url)
  }
  const paper = await openPaperSync(docId, browserSyncPorts(docId, queryClient))
  return {
    kind: "saved",
    docId,
    title,
    doc: paper.doc,
    sync: { paper, actor: check.session.user.id },
  }
}

export function PaperLabPage() {
  const queryClient = useQueryClient()
  const [lab, dispatch] = useReducer(labReducer, { kind: "opening" })

  useEffect(() => {
    let alive = true
    let opened: LabState | null = null
    openLab(queryClient)
      .then((state) => {
        opened = state
        if (alive) dispatch({ type: "opened", state })
        else if (state.kind === "saved") state.sync.paper.close()
      })
      .catch((error: unknown) => {
        if (alive)
          dispatch({
            type: "opened",
            state: {
              kind: "failed",
              message:
                error instanceof Error ? error.message : "Could not open Paper",
            },
          })
      })
    return () => {
      alive = false
      if (opened?.kind === "saved") opened.sync.paper.close()
    }
  }, [queryClient])

  const savedId = lab.kind === "saved" ? lab.docId : null
  useEffect(
    () => (savedId === null ? undefined : holdWritingCoachFocus(savedId)),
    [savedId]
  )

  if (lab.kind === "opening")
    return <main aria-label="Paper test page" aria-busy="true" />
  if (lab.kind === "failed")
    return (
      <main aria-label="Paper test page">
        <p role="alert">{lab.message}</p>
      </main>
    )
  const savedProps =
    lab.kind === "saved"
      ? {
          title: lab.title,
          download: {
            start: (format: "word" | "pdf") => {
              void downloadEnginePaper(
                queryClient,
                lab.docId,
                format === "word" ? "docx" : "pdf"
              ).catch(() =>
                toast.error("Paper could not download this file. Try again.")
              )
            },
          },
          onPrint: () => {
            void openEnginePaperPdf(queryClient, lab.docId).catch(() =>
              toast.error("Paper could not open the PDF. Try again.")
            )
          },
          photoReason: "Needs a saved photo",
          sync: lab.sync,
        }
      : {
          title: LAB_TITLE,
          download: LAB_DOWNLOAD,
          photoReason: "Needs a saved Paper",
        }
  return (
    <main aria-label="Paper test page">
      <PaperChrome doc={lab.doc} onEditor={exposeLabEditor} {...savedProps} />
    </main>
  )
}
