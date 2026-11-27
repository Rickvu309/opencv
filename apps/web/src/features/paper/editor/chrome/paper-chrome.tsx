import "./paper-toolbar.css"
import "./paper-chrome-print.css"

import { startTransition, useEffect, useReducer, useRef } from "react"

import {
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"
import { toast } from "@workspace/ui/components/sonner"

import { SAVE_LABEL, type PaperSync, type SyncView } from "@/lib/paper-sync.ts"
import { useShortcut } from "@/lib/use-shortcut.ts"

import type { Document } from "@workspace/domain/paper-doc"

import { mountPaperEditor, type PaperEditor } from "../paper-editor.ts"
import { FileMenu, type PaperDownload } from "./file-menu.tsx"
import { pageSetupCommands } from "./format-commands.ts"
import { PageSetupDialog } from "./page-setup-dialog.tsx"
import { PaperToolbar } from "./paper-toolbar.tsx"
import { RecoveryPanel } from "./recovery-panel.tsx"
import {
  sameSelectionFormat,
  selectionFormat,
  type SelectionFormat,
} from "./selection-format.ts"
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
  saving: SyncView | null
}

export type ChromeSync = { paper: PaperSync; actor: string }

type ChromeAction =
  | { type: "mounted"; editor: PaperEditor; snapshot: Snapshot }
  | { type: "changed"; snapshot: Snapshot }
  | { type: "opened"; dialog: Dialog }
  | { type: "closed"; dialog: Dialog }
  | { type: "synced"; view: SyncView | null }

const INITIAL: ChromeState = {
  editor: null,
  snapshot: null,
  open: null,
  saving: null,
}

function chromeReducer(state: ChromeState, action: ChromeAction): ChromeState {
  if (action.type === "mounted")
    return {
      ...state,
      editor: action.editor,
      snapshot: action.snapshot,
    }
  if (action.type === "changed") return { ...state, snapshot: action.snapshot }
  if (action.type === "opened") return { ...state, open: action.dialog }
  if (action.type === "synced") return { ...state, saving: action.view }
  return state.open === action.dialog ? { ...state, open: null } : state
}

export function PaperChrome({
  doc,
  title,
  download,
  photoReason,
  onEditor,
  onPrint,
  sync,
}: {
  doc: Document
  title: string
  download: PaperDownload
  photoReason: string
  onPrint?: () => void
  onEditor?: (editor: PaperEditor | null) => void
  sync?: ChromeSync
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
    const mounted = mountPaperEditor(host.current!, {
      doc,
      ...(sync
        ? {
            seat: {
              state: sync.paper.current(),
              client: sync.paper.writer,
              actor: sync.actor,
            },
          }
        : {}),
    })
    let previous = snapshot(mounted)
    const unsubscribe = mounted.subscribe(() => {
      sync?.paper.local()
      const next = snapshot(mounted)
      if (
        next.history.undo === previous.history.undo &&
        next.history.redo === previous.history.redo &&
        sameSelectionFormat(next.format, previous.format)
      )
        return
      previous = next
      startTransition(() => dispatch({ type: "changed", snapshot: next }))
    })
    const detach = sync?.paper.attach({
      state: mounted.state,
      adopt: mounted.adopt,
      caret: mounted.caret,
    })
    const showView = () => {
      const view = sync?.paper.view() ?? null
      mounted.showPeers(view?.peers.map((peer) => peer.pos) ?? [])
      dispatch({ type: "synced", view })
    }
    const unwatch = sync?.paper.subscribe(showView)
    showView()
    dispatch({ type: "mounted", editor: mounted, snapshot: previous })
    latest.current?.(mounted)
    mounted.focus()
    return () => {
      unwatch?.()
      detach?.()
      unsubscribe()
      latest.current?.(null)
      mounted.destroy()
    }
  }, [doc, sync])

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
          {chrome.saving ? (
            <p
              className="writing-note text-sm text-muted-foreground"
              title={SAVE_LABEL[chrome.saving.status]}
              aria-live="polite"
            >
              {SAVE_LABEL[chrome.saving.status]}
            </p>
          ) : null}
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
      {sync && chrome.saving ? (
        <RecoveryPanel
          texts={chrome.saving.recovered}
          onDismiss={(index) => sync.paper.dismiss(index)}
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
