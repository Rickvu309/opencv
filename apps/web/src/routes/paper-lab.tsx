import { useEffect, useRef } from "react"

import { labDocument } from "@/features/paper/editor/lab-documents.ts"
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
    const name = new URLSearchParams(window.location.search).get("doc")
    const editor = mountPaperEditor(host.current!, { doc: labDocument(name) })
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
