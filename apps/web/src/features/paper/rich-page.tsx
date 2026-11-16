import {
  useEffect,
  useLayoutEffect,
  useRef,
  useReducer,
  useSyncExternalStore,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Bold, Italic, Strikethrough, Underline } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  PageHeader,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"
import {
  mountRichPaperEditor,
  type RichMark,
} from "@workspace/paper-crdt/editor"
import { openRichPaperSession } from "@/lib/paper-rich.ts"
import { resolvePhotoSrc } from "@/lib/requests.ts"
import type { NativeSyncIdentity } from "@/lib/paper-sync-identity.ts"
import { SYNC_LABEL } from "@/lib/paper-sync.ts"
import "./design/rich-page-header.pen.css"
import { RichPhotoControls } from "./rich-photo-controls.tsx"

type Session = ReturnType<typeof openRichPaperSession>
type Editor = ReturnType<typeof mountRichPaperEditor>
type ActiveMarks = Partial<Record<RichMark, boolean>>
type EditorState = {
  session: Session | null
  editor: Editor | null
  activeMarks: ActiveMarks
  editorError: boolean
}
type EditorAction =
  | { type: "session"; session: Session }
  | { type: "mounted"; editor: Editor; activeMarks: ActiveMarks }
  | { type: "marks"; activeMarks: ActiveMarks }
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
        activeMarks: action.activeMarks,
        editorError: false,
      }
    case "marks":
      return { ...state, activeMarks: action.activeMarks }
    case "unmounted":
      return { ...state, editor: null }
    case "failed":
      return { ...state, editorError: true }
  }
}

const marks = [
  { mark: "bold", label: "Bold", Icon: Bold },
  { mark: "italic", label: "Italic", Icon: Italic },
  { mark: "underline", label: "Underline", Icon: Underline },
  { mark: "strike", label: "Strikethrough", Icon: Strikethrough },
] as const

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
  const [{ session, editor, activeMarks, editorError }, dispatch] = useReducer(
    editorReducer,
    {
      session: null,
      editor: null,
      activeMarks: {},
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
    try {
      const mounted = mountRichPaperEditor(client, element.current, {
        photoUrl: resolvePhotoSrc,
      })
      dispatch({
        type: "mounted",
        editor: mounted,
        activeMarks: mounted.activeMarks(),
      })
      const detach = mounted.subscribe(() =>
        dispatch({ type: "marks", activeMarks: mounted.activeMarks() })
      )
      return () => {
        detach()
        mounted.destroy()
        dispatch({ type: "unmounted" })
      }
    } catch {
      dispatch({ type: "failed" })
    }
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
        <span role="status" className="ml-auto text-sm text-muted-foreground">
          {editorError
            ? "Editor unavailable. Your document is kept"
            : SYNC_LABEL[status]}
        </span>
      </PageHeader>
      <RichPhotoControls editor={editor} disabled={blocked}>
        {marks.map(({ mark, label, Icon }) => (
          <Button
            key={mark}
            variant={activeMarks[mark] ? "secondary" : "ghost"}
            size="icon"
            className="size-11 md:size-8"
            aria-label={label}
            aria-pressed={activeMarks[mark] === true}
            disabled={!editor || blocked}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor?.toggleMark(mark)
              if (editor)
                dispatch({ type: "marks", activeMarks: editor.activeMarks() })
            }}
          >
            <Icon />
          </Button>
        ))}
      </RichPhotoControls>
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
          className="mx-auto min-h-[11in] w-full max-w-[8.5in] border bg-card p-5 text-card-foreground shadow-sm sm:p-[1in] [&_figure[data-paper-photo]]:cursor-pointer [&_figure[data-paper-photo]]:touch-manipulation [&_figure[data-paper-photo]]:select-none [&_figure[data-paper-photo]]:active:opacity-80 [@media(hover:hover)_and_(pointer:fine)]:[&_figure[data-paper-photo]]:hover:ring-1 [@media(hover:hover)_and_(pointer:fine)]:[&_figure[data-paper-photo]]:hover:ring-ring"
        />
      </div>
    </section>
  )
}
