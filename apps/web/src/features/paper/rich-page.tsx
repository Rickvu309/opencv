import {
  useEffect,
  useLayoutEffect,
  useRef,
  useReducer,
  useSyncExternalStore,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "@workspace/ui/components/popover"
import {
  PaperDocumentHeader,
  PaperDocumentCanvas,
  PaperDocumentTitle,
} from "@/features/paper-page/document-chrome.tsx"
import { PaperDocumentShare } from "./document-share.tsx"
import { RichLinkDialog } from "./rich-structure-controls.tsx"
import { RichSelectionBubble } from "./rich-selection-bubble.tsx"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { RichTableControls } from "./rich-table-controls.tsx"
import { RichPhotoControls } from "./rich-photo-controls.tsx"
import { RichPaperTextFormatting } from "./rich-text-formatting.tsx"
import { openRichPaperSession } from "@/lib/paper-rich.ts"
import { resolvePhotoSrc } from "@/lib/requests.ts"
import type { NativeSyncIdentity } from "@/lib/paper-sync-identity.ts"
import { SYNC_LABEL } from "@/lib/paper-sync.ts"
import { useRichStatusDetail } from "./rich-status-detail.ts"
import { mountRichEditorLifecycle } from "./rich-editor-lifecycle.ts"
import { RichFindBar, type PaperFindMode } from "./rich-find-bar.tsx"
import { RichDocumentMenu } from "./rich-document-menu.tsx"
import "./design/rich-page-header.css"
import "./design/paper-writing-page.css"
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
  kind = "cv",
}: {
  name: string
  kind?: "cv" | "letter"
  identity: NativeSyncIdentity
  onBack: () => void
}) {
  const [findMode, setFindMode] = useReducer(
    (_: PaperFindMode, mode: PaperFindMode) => mode,
    "closed"
  )
  const [formattingOpen, setFormattingOpen] = useReducer(
    (_: boolean, next: boolean) => next,
    false
  )
  const queryClient = useQueryClient()
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
        statusRef={statusRef}
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
        actions={
          <>
            <PaperDocumentShare docId={identity.docId} />
            <Popover open={formattingOpen} onOpenChange={setFormattingOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 md:size-8"
                    aria-label="Formatting and insert"
                  >
                    <SlidersHorizontal />
                  </Button>
                }
              />
              <PopoverContent
                align="end"
                className="max-h-[calc(100dvh-8rem)] w-[min(48rem,calc(100vw-1rem))] motion-pop overflow-y-auto"
                finalFocus={() => {
                  editor?.apply()
                  return null
                }}
              >
                <PopoverTitle className="px-2 text-xs text-muted-foreground">
                  Formatting and insert
                </PopoverTitle>
                <RichTableControls editor={editor} disabled={blocked}>
                  {(tableControls) => (
                    <RichPhotoControls editor={editor} disabled={blocked}>
                      {(photoControls) => (
                        <RichPaperTextFormatting
                          panel
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
              </PopoverContent>
            </Popover>
          </>
        }
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
        onMore={() => setFormattingOpen(true)}
      />
      <RichFindBar
        editor={editor}
        disabled={blocked}
        mode={findMode}
        onModeChange={setFindMode}
      />
      {blocked ? (
        <p role="alert" className="p-6 text-sm">
          Paper could not safely open these changes. Your saved document and
          recovery drafts are kept. Reload to try again.
        </p>
      ) : null}
      <div
        data-paper-document-pane=""
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-background p-4 md:p-6"
      >
        <PaperDocumentCanvas
          title={<PaperDocumentTitle name={name} docId={identity.docId} />}
        >
          <div data-paper-page-viewport>
            <div
              ref={element}
              aria-busy={status === "loading"}
              data-slot="paper-rich-sheet"
              className="paper-rich-sheet mx-auto rounded-[2px] text-card-foreground"
            />
          </div>
        </PaperDocumentCanvas>
      </div>
    </section>
  )
}
