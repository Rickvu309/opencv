import {
  useEffect,
  useLayoutEffect,
  useRef,
  useReducer,
  useSyncExternalStore,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  PageHeader,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { RichTableControls } from "./rich-table-controls.tsx"
import { RichPhotoControls } from "./rich-photo-controls.tsx"
import { RichPaperTextFormatting } from "./rich-text-formatting.tsx"
import { openRichPaperSession } from "@/lib/paper-rich.ts"
import { resolvePhotoSrc } from "@/lib/requests.ts"
import type { NativeSyncIdentity } from "@/lib/paper-sync-identity.ts"
import { SYNC_LABEL } from "@/lib/paper-sync.ts"
import { mountRichEditorLifecycle } from "./rich-editor-lifecycle.ts"
import { RichDocumentMenu } from "./rich-document-menu.tsx"
import "./design/rich-page-header.pen.css"

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
}: {
  name: string
  identity: NativeSyncIdentity
  onBack: () => void
}) {
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
  const blocked = status === "stuck" || status === "refused" || editorError
  useEffect(() => {
    editor?.setEditable(!blocked)
  }, [editor, blocked])
  return (
    <section
      aria-label="Paper"
      data-pen-surface="paper"
      className="rich-paper-page flex min-h-0 flex-1 flex-col"
    >
      <PageHeader>
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:size-8"
            aria-label="Back to Paper"
            onClick={onBack}
          >
            <ArrowLeft />
          </Button>
          <PageHeaderTitle className="text-[0.8125rem] leading-[1rem] [overflow-wrap:anywhere] whitespace-normal max-md:min-w-0">
            {name}
          </PageHeaderTitle>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span role="status" className="text-sm text-muted-foreground">
            {editorError
              ? "Editor unavailable. Your document is kept"
              : SYNC_LABEL[status]}
          </span>
          <RichDocumentMenu
            editorAvailable={!!editor}
            session={session}
            status={status}
            blocked={blocked}
          />
        </div>
      </PageHeader>
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
      {blocked ? (
        <p role="alert" className="p-6 text-sm">
          Paper could not safely open these changes. Your saved document and
          recovery drafts are kept. Reload to try again.
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 md:p-6">
        <div
          ref={element}
          aria-busy={status === "loading"}
          className="mx-auto min-h-[11in] w-full max-w-[8.5in] border bg-card p-5 text-card-foreground shadow-sm sm:p-[1in]"
        />
      </div>
    </section>
  )
}
