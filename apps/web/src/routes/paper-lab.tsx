import { PaperChrome } from "@/features/paper/editor/chrome/paper-chrome.tsx"
import { labDocument } from "@/features/paper/editor/lab-documents.ts"
import type { PaperEditor } from "@/features/paper/editor/paper-editor.ts"

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

export function PaperLabPage() {
  const name = new URLSearchParams(window.location.search).get("doc")
  return (
    <main aria-label="Paper test page">
      <PaperChrome
        doc={labDocument(name)}
        title="Paper test page"
        download={LAB_DOWNLOAD}
        photoReason="Needs a saved Paper"
        onEditor={exposeLabEditor}
      />
    </main>
  )
}
