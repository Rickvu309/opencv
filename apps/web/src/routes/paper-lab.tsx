import { useQuery, useQueryClient } from "@tanstack/react-query"
import { paperIdSchema } from "@workspace/domain/kernel"
import { toast } from "sonner"

import { PaperChrome } from "@/features/paper/editor/chrome/paper-chrome.tsx"
import { labDocument } from "@/features/paper/editor/lab-documents.ts"
import type { PaperEditor } from "@/features/paper/editor/paper-editor.ts"

import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import {
  downloadEnginePaper,
  openEnginePaperPdf,
} from "@/lib/paper-engine-download.ts"

declare global {
  interface Window {
    paperLab?: PaperEditor
  }
}

const LAB_DOWNLOAD = { reason: "Save this Paper first to download it" }

function exposeLabEditor(editor: PaperEditor | null) {
  if (editor) window.paperLab = editor
  else delete window.paperLab
}

function SavedPaper({ docId }: { docId: string }) {
  const session = authClient.useSession()
  const owner = session.data?.user.id ?? ""
  const client = useQueryClient()
  const saved = useQuery({
    ...catalogClient.options(owner, "paper.read", { docId, view: "engine" }),
    enabled: owner !== "",
    retry: false,
  })
  if (session.isPending || saved.isLoading) return <p>Loading Paper…</p>
  if (!saved.data || !("doc" in saved.data))
    return <p>Paper could not be opened.</p>

  return (
    <PaperChrome
      doc={saved.data.doc}
      title={saved.data.name}
      download={{
        start: (format) => {
          void downloadEnginePaper(
            client,
            docId,
            format === "word" ? "docx" : "pdf"
          ).catch(() =>
            toast.error("Paper could not download this file. Try again.")
          )
        },
      }}
      onPrint={() => {
        void openEnginePaperPdf(client, docId).catch(() =>
          toast.error("Paper could not open the PDF. Try again.")
        )
      }}
      photoReason="Needs a saved photo"
      onEditor={exposeLabEditor}
    />
  )
}

export function PaperLabPage() {
  const search = new URLSearchParams(window.location.search)
  const name = search.get("doc")
  const saved = paperIdSchema.safeParse(search.get("paper"))
  return (
    <main aria-label="Paper test page">
      {saved.success ? (
        <SavedPaper docId={saved.data} />
      ) : (
        <PaperChrome
          doc={labDocument(name)}
          title="Paper test page"
          download={LAB_DOWNLOAD}
          photoReason="Needs a saved Paper"
          onEditor={exposeLabEditor}
        />
      )}
    </main>
  )
}
