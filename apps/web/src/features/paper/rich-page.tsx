import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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

type Session = ReturnType<typeof openRichPaperSession>
type Editor = ReturnType<typeof mountRichPaperEditor>

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
  const [session, setSession] = useState<Session | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [activeMarks, setActiveMarks] = useState<
    Partial<Record<RichMark, boolean>>
  >({})
  const [editorError, setEditorError] = useState(false)
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opened = openRichPaperSession({
      identity: currentIdentity.current,
      currentIdentity: () => currentIdentity.current,
      queryClient,
      journal: localStorage,
    })
    setSession(opened)
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
      setEditor(mounted)
      setActiveMarks(mounted.activeMarks())
      const detach = mounted.subscribe(() =>
        setActiveMarks(mounted.activeMarks())
      )
      return () => {
        detach()
        mounted.destroy()
        setEditor(null)
      }
    } catch {
      setEditorError(true)
    }
  }, [client])
  const blocked = status === "stuck" || status === "refused" || editorError
  useEffect(() => {
    editor?.setEditable(!blocked)
  }, [editor, blocked])
  return (
    <section aria-label="Paper" className="flex min-h-0 flex-1 flex-col">
      <PageHeader className="h-auto min-h-[52px] py-2">
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
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-3 border-b px-4 py-2"
      >
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
              if (editor) setActiveMarks(editor.activeMarks())
            }}
          >
            <Icon />
          </Button>
        ))}
      </div>
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
