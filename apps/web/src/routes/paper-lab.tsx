import { useEffect, useRef } from "react"

import {
  labDocument,
  labSuggestions,
} from "@/features/paper/editor/lab-documents.ts"
import {
  mountPaperEditor,
  type PaperEditor,
} from "@/features/paper/editor/paper-editor.ts"

declare global {
  interface Window {
    paperLab?: PaperEditor
  }
}

export function PaperLabPage() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const name = params.get("doc")
    const editor = mountPaperEditor(host.current!, { doc: labDocument(name) })
    if (params.get("suggest") === "coach")
      editor.suggest(labSuggestions(name), {
        approve: () => Promise.resolve(),
        deny: () => Promise.resolve(),
      })
    window.paperLab = editor
    editor.focus()
    return () => {
      editor.destroy()
      if (window.paperLab === editor) delete window.paperLab
    }
  }, [])
  return (
    <main className="h-dvh overflow-auto bg-muted" aria-label="Paper test page">
      <div ref={host} data-paper-lab="" />
    </main>
  )
}
