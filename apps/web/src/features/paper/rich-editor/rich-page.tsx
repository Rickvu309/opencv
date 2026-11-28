import {
  useEffect,
  useLayoutEffect,
  useRef,
  useReducer,
  useSyncExternalStore,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  PaperDocumentHeader,
  PaperDocumentCanvas,
  PaperDocumentTitle,
  PaperDocumentRuler,
} from "@/features/paper-page/document-chrome.tsx"
import { PaperDocumentShare } from "../document-share.tsx"
import { RichLinkDialog } from "./rich-structure-controls.tsx"
import { RichSelectionBubble } from "./rich-selection-bubble.tsx"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { RichTableControls } from "./rich-table-controls.tsx"
import { RichPhotoControls } from "./rich-photo-controls.tsx"
import { RichPaperTextFormatting } from "./rich-text-formatting.tsx"
import { RichDocumentMenuBar } from "./rich-document-menubar.tsx"
import { openRichPaperSession } from "@/lib/paper-rich.ts"
import { holdWritingCoachFocus } from "@/lib/writing-coach-focus.ts"
import { resolvePhotoSrc } from "@/lib/requests.ts"
import type { NativeSyncIdentity } from "@/lib/paper-sync-identity.ts"
import { SYNC_LABEL } from "@/lib/paper-sync-status.ts"
import { useRichStatusDetail } from "./rich-status-detail.ts"
import { mountRichEditorLifecycle } from "./rich-editor-lifecycle.ts"
import { RichFindBar, type PaperFindMode } from "./rich-find-bar.tsx"
import { RichDocumentMenu } from "./rich-document-menu.tsx"
import { RichLetterStopped } from "../paper-letter-stopped-rich.tsx"
import "./design/rich-page-header.css"
import "../design/paper-writing-page.css"
import "./design/rich-desk.css"
import "./rich-page-geometry.css"

type Session = ReturnType<typeof openRichPaperSession>
type Editor = ReturnType<typeof mountRichPaperEditor>
type EditorState = {
  session: Session | null
  editor: Editor | null
  editorError: boolean
}
type EditorAction =
  | { type: "session"; session: Session }
  | { type: "mounted"; editor: Editor }
  | { type: "unmounted" }
  | { type: "failed" }

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "session":
      return { ...state, session: action.session }
    case "mounted":
      return {
        ...state,
        editor: action.editor,
        editorError: false,
      }
    case "unmounted":
      return { ...state, editor: null }
    case "failed":
      return { ...state, editorError: true }
  }
}

export function RichPaperPage({
  name,
  identity,
  onBack,
  onOpen,
  kind = "cv",
  editedAt,
}: {
  name: string
  kind?: "cv" | "letter"
  editedAt: string
  identity: NativeSyncIdentity
  onBack: () => void
  onOpen: (docId: string) => void
}) {
  const [findMode, setFindMode] = useReducer(
    (_: PaperFindMode, mode: PaperFindMode) => mode,
    "closed"
  )
  const queryClient = useQueryClient()
  useEffect(() => holdWritingCoachFocus(identity.docId), [identity.docId])
  const currentIdentity = useRef(identity)
  useLayoutEffect(() => {
    currentIdentity.current = identity
  }, [identity])
  const [{ session, editor, editorError }, dispatch] = useReducer(
    editorReducer,
    {
      session: null,
      editor: null,
      editorError: false,
    }
  )
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opened = openRichPaperSession({
      identity: currentIdentity.current,
      currentIdentity: () => currentIdentity.current,
      queryClient,
      journal: localStorage,
    })
    dispatch({ type: "session", session: opened })
    return () => {
      void opened.destroy()
    }
  }, [queryClient])
  const status = useSyncExternalStore(
    session?.subscribe ?? (() => () => {}),
    session?.status ?? (() => "loading" as const)
  )
  const client = session?.client() ?? null
  useEffect(() => {
    if (!client || !element.current) return
    return mountRichEditorLifecycle(client, element.current, {
      photoUrl: resolvePhotoSrc,
      mounted(mounted) {
        dispatch({ type: "mounted", editor: mounted })
      },
      released() {
        dispatch({ type: "unmounted" })
      },
      failed() {
        dispatch({ type: "failed" })
      },
    })
  }, [client])
  const statusLabel = editorError
    ? "Editor unavailable. Your document is kept"
    : SYNC_LABEL[status]
  const {
    statusRef,
    detailRef,
    visible: statusDetailVisible,
    minHeight: statusDetailHeight,
  } = useRichStatusDetail(statusLabel, status === "saved" && !editorError)
  const blocked = status === "stuck" || status === "refused" || editorError
  useEffect(() => {
    editor?.setEditable(!blocked)
  }, [editor, blocked])
  return (
    <section
      aria-label="Paper"
      data-surface="paper"
      className="rich-paper-page flex h-full min-h-0 flex-1 flex-col overflow-clip"
    >
      <PaperDocumentHeader
        name={name}
        kind={kind}
        onBack={onBack}
        status={statusLabel}
        editedAt={editedAt}
        statusRef={statusRef}
        editableName={<PaperDocumentTitle name={name} docId={identity.docId} />}
        menu={
          <RichDocumentMenu
            editorAvailable={!!editor}
            editor={editor}
            onFind={setFindMode}
            session={session}
            status={status}
            blocked={blocked}
          />
        }
        actions={<PaperDocumentShare docId={identity.docId} />}
      />
      <RichDocumentMenuBar
        editor={editor}
        session={session}
        status={status}
        blocked={blocked}
        onFind={setFindMode}
      />
      {statusDetailVisible ? (
        <p
          aria-hidden="true"
          ref={detailRef}
          style={{ minHeight: statusDetailHeight }}
          data-slot="paper-status-detail"
          className="shrink-0 px-6 py-3 text-sm [overflow-wrap:anywhere] text-muted-foreground"
        >
          {statusLabel}
        </p>
      ) : null}
      <RichLinkDialog editor={editor} blocked={blocked} />
      <RichSelectionBubble
        editor={editor}
        root={element}
        blocked={blocked}
        docId={identity.docId}
        name={name}
      />
      <div
        data-paper-toolbar-band=""
        className="shrink-0 bg-surface-sunken px-4 pt-1.5 pb-2 md:px-6"
      >
        <div className="paper-doc-toolbar min-w-0">
          <RichTableControls editor={editor} disabled={blocked}>
            {(tableControls) => (
              <RichPhotoControls editor={editor} disabled={blocked}>
                {(photoControls) => (
                  <RichPaperTextFormatting
                    editor={editor}
                    blocked={blocked}
                    photoControls={(close) => (
                      <>
                        {photoControls(close)}
                        {tableControls(close)}
                      </>
                    )}
                  />
                )}
              </RichPhotoControls>
            )}
          </RichTableControls>
          <Button
            variant="ghost"
            size="icon"
            className="paper-doc-find-button size-11 shrink-0 md:size-8"
            aria-label="Find and replace"
            title="Find and replace"
            disabled={!editor || blocked}
            onClick={() => setFindMode("replace")}
          >
            <Search />
          </Button>
        </div>
      </div>
      <RichFindBar
        editor={editor}
        disabled={blocked}
        mode={findMode}
        onModeChange={setFindMode}
      />
      {kind === "letter" ? (
        <RichLetterStopped
          docId={identity.docId}
          name={name}
          source={client}
          onOpen={onOpen}
        />
      ) : null}
      {blocked ? (
        <p role="alert" className="p-6 text-sm">
          Paper could not safely open these changes. Your saved document and
          recovery drafts are kept. Reload to try again.
        </p>
      ) : null}
      <div
        data-paper-document-pane=""
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-surface-sunken p-4 md:p-6"
      >
        <PaperDocumentCanvas ruler={<PaperDocumentRuler />}>
          <div data-paper-page-viewport>
            <div
              ref={element}
              aria-busy={status === "loading"}
              data-slot="paper-rich-sheet"
              className="paper-rich-sheet mx-auto rounded-xs text-card-foreground"
            />
          </div>
        </PaperDocumentCanvas>
      </div>
    </section>
  )
}
