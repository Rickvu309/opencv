import "./paper-toolbar.css"

import { useEffect, useReducer, useRef } from "react"

import {
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"
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

type Dialog = "link" | "pageSetup" | "shortcuts"

type ChromeState = {
  editor: PaperEditor | null
  snapshot: Snapshot | null
  open: Dialog | null
}

type ChromeAction =
  | { type: "mounted"; editor: PaperEditor }
  | { type: "changed"; snapshot: Snapshot }
  | { type: "opened"; dialog: Dialog }
  | { type: "closed"; dialog: Dialog }

const INITIAL: ChromeState = { editor: null, snapshot: null, open: null }

function chromeReducer(state: ChromeState, action: ChromeAction): ChromeState {
  if (action.type === "mounted")
    return {
      ...state,
      editor: action.editor,
      snapshot: snapshot(action.editor),
    }
  if (action.type === "changed") return { ...state, snapshot: action.snapshot }
  if (action.type === "opened") return { ...state, open: action.dialog }
  return state.open === action.dialog ? { ...state, open: null } : state
}

export function PaperChrome({
  doc,
  title,
  download,
  photoReason,
  onEditor,
  onPrint,
}: {
  doc: Document
  title: string
  download: PaperDownload
  photoReason: string
  onPrint?: () => void
  onEditor?: (editor: PaperEditor | null) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [chrome, dispatch] = useReducer(chromeReducer, INITIAL)
  const { editor, snapshot: state } = chrome
  const toggle = (dialog: Dialog) => (open: boolean) =>
    dispatch({ type: open ? "opened" : "closed", dialog })
  const setLinkOpen = toggle("link")
  const setPageSetupOpen = toggle("pageSetup")
  const setShortcutsOpen = toggle("shortcuts")
  const latest = useRef(onEditor)
  useEffect(() => {
    latest.current = onEditor
  })

  useEffect(() => {
    const mounted = mountPaperEditor(host.current!, { doc })
    const unsubscribe = mounted.subscribe(() =>
      dispatch({ type: "changed", snapshot: snapshot(mounted) })
    )
    dispatch({ type: "mounted", editor: mounted })
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
      if (onPrint) onPrint()
      else if ("start" in download) download.start("pdf")
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
      <PageHeader data-slot="paper-chrome-header">
        <PageHeaderTitle>{title}</PageHeaderTitle>
        <PageHeaderActions>
          <FileMenu
            download={download}
            back={back}
            onPageSetup={() => setPageSetupOpen(true)}
            onShortcuts={() => setShortcutsOpen(true)}
          />
        </PageHeaderActions>
      </PageHeader>
      {editor && state ? (
        <PaperToolbar
          editor={editor}
          format={state.format}
          history={state.history}
          linkOpen={chrome.open === "link"}
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
          open={chrome.open === "pageSetup"}
          page={state.format.page}
          onOpenChange={setPageSetupOpen}
          onApply={(page) => {
            editor.apply(pageSetupCommands(page))
            setPageSetupOpen(false)
            editor.focus()
          }}
        />
      ) : null}
      <ShortcutList
        open={chrome.open === "shortcuts"}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  )
}
