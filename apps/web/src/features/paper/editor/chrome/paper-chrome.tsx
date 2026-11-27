import "./paper-toolbar.css"

import { useEffect, useRef, useState } from "react"

import { toast } from "@workspace/ui/components/sonner"

import { useShortcut } from "@/lib/use-shortcut.ts"

import type { Document } from "@workspace/domain/paper-doc"

import { mountPaperEditor, type PaperEditor } from "../paper-editor.ts"
import { FileMenu, type PaperDownload } from "./file-menu.tsx"
import { pageSetupCommands } from "./format-commands.ts"
import { PageSetupDialog } from "./page-setup-dialog.tsx"
import { PaperToolbar } from "./paper-toolbar.tsx"
import { selectionFormat, type SelectionFormat } from "./selection-format.ts"
import { ShortcutList } from "./shortcut-list.tsx"

type Snapshot = {
  format: SelectionFormat
  history: { undo: boolean; redo: boolean }
}

function snapshot(editor: PaperEditor): Snapshot {
  return {
    format: selectionFormat(editor.read().doc, editor.range()),
    history: editor.history(),
  }
}

export function PaperChrome({
  doc,
  title,
  download,
  photoReason,
  onEditor,
}: {
  doc: Document
  title: string
  download: PaperDownload
  photoReason: string
  onEditor?: (editor: PaperEditor | null) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<PaperEditor | null>(null)
  const [state, setState] = useState<Snapshot | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [pageSetupOpen, setPageSetupOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const latest = useRef(onEditor)
  useEffect(() => {
    latest.current = onEditor
  })

  useEffect(() => {
    const mounted = mountPaperEditor(host.current!, { doc })
    const unsubscribe = mounted.subscribe(() => setState(snapshot(mounted)))
    setEditor(mounted)
    setState(snapshot(mounted))
    latest.current?.(mounted)
    mounted.focus()
    return () => {
      unsubscribe()
      latest.current?.(null)
      mounted.destroy()
    }
  }, [doc])

  useShortcut({
    key: "p",
    mod: true,
    inFields: true,
    capture: true,
    stop: true,
    onPress: () => {
      if ("start" in download) download.start("pdf")
      else toast(download.reason)
    },
  })
  useShortcut({
    key: "/",
    mod: true,
    inFields: true,
    capture: true,
    stop: true,
    onPress: () => setShortcutsOpen(true),
  })
  useShortcut({
    key: "k",
    mod: true,
    inFields: true,
    capture: true,
    prevent: false,
    onPress: (event) => {
      if (!host.current?.contains(event.target as Node)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setLinkOpen(true)
    },
  })

  const back = (): false => {
    editor?.focus()
    return false
  }

  return (
    <div className="paper-chrome text-ui" data-paper-chrome="">
      <header className="paper-chrome-top">
        <h1 className="paper-chrome-title text-ui">{title}</h1>
        <FileMenu
          download={download}
          back={back}
          onPageSetup={() => setPageSetupOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
        />
      </header>
      {editor && state ? (
        <PaperToolbar
          editor={editor}
          format={state.format}
          history={state.history}
          linkOpen={linkOpen}
          onLinkOpen={(open) => {
            setLinkOpen(open)
            if (!open) editor.focus()
          }}
          photoReason={photoReason}
        />
      ) : null}
      <div className="paper-chrome-canvas">
        <div ref={host} data-paper-lab="" />
      </div>
      {editor && state ? (
        <PageSetupDialog
          open={pageSetupOpen}
          page={state.format.page}
          onOpenChange={setPageSetupOpen}
          onApply={(page) => {
            editor.apply(pageSetupCommands(page))
            setPageSetupOpen(false)
            editor.focus()
          }}
        />
      ) : null}
      <ShortcutList open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}
