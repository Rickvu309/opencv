import {
  useEffect,
  useRef,
  useReducer,
  type ReactNode,
  type Ref,
  type MouseEvent,
} from "react"
import { ChevronRight, FileText, Link } from "lucide-react"
import {
  paperIdSchema,
  paperRenameInputSchema,
  RICH_NATIVE_WRITER,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useRunCommand } from "@/lib/contract-client.ts"
import { toast } from "sonner"
import { useShareLink } from "./paper-share-link.ts"
import { PaperDocumentOutline } from "./document-outline.tsx"
import "./document-chrome.css"

export function PaperDocumentHeader({
  name,
  kind = "cv",
  onBack,
  status,
  menu,
  actions,
  statusRef,
}: {
  name: string
  kind?: "cv" | "letter"
  onBack?: () => void
  status: string
  menu?: ReactNode
  actions?: ReactNode
  statusRef?: Ref<HTMLParagraphElement>
}) {
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onBack) {
      event.preventDefault()
      onBack()
    }
  }
  return (
    <header
      data-slot="writing-document-header"
      className="paper-document-header"
    >
      <nav aria-label="Breadcrumb" className="paper-document-breadcrumb">
        <a href="/paper" aria-label="Back to Paper" onClick={back}>
          Paper
        </a>
        <ChevronRight aria-hidden="true" />
        <a
          href={kind === "cv" ? "/paper?tab=cvs" : "/paper?tab=letters"}
          onClick={back}
        >
          {kind === "cv" ? "CVs" : "Letters"}
        </a>
        <ChevronRight aria-hidden="true" />
        <FileText aria-hidden="true" />
        <span className="truncate" title={name}>
          {name}
        </span>
      </nav>
      {menu}
      <div className="paper-document-header-actions">
        <p
          ref={statusRef}
          className="writing-note writing-header-status truncate"
          role="status"
          title={status}
        >
          {status === "Saved" ? (
            <>
              <span>Edited just now</span>
              <span className="sr-only"> Saved</span>
            </>
          ) : (
            status
          )}
        </p>
        {actions}
      </div>
    </header>
  )
}

export function PaperDocumentShare({ docId }: { docId: string }) {
  const parsed = paperIdSchema.safeParse(docId)
  return parsed.success ? <CopyLink docId={parsed.data} /> : null
}

function CopyLink({
  docId,
}: {
  docId: ReturnType<typeof paperIdSchema.parse>
}) {
  const share = useShareLink(docId)
  const [copied, setCopied] = useReducer(
    (_: boolean, next: boolean) => next,
    false
  )
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 md:size-8"
      aria-label={copied ? "Link copied" : "Copy link"}
      onClick={() => {
        void share()
          .then((url) => navigator.clipboard.writeText(url))
          .then(() => setCopied(true))
          .catch(() => toast.error("Could not copy the document link."))
      }}
    >
      <Link aria-hidden="true" />
    </Button>
  )
}

export function PaperDocumentTitle({
  name,
  docId,
}: {
  name: string
  docId: string
}) {
  const run = useRunCommand()
  const [editing, setEditing] = useReducer(
    (_: boolean, next: boolean) => next,
    false
  )
  const [draft, setDraft] = useReducer((_: string, next: string) => next, name)
  const [savedName, setSavedName] = useReducer(
    (_: string, next: string) => next,
    name
  )
  const [error, setError] = useReducer((_: string, next: string) => next, "")
  const saving = useRef(false)
  useEffect(() => {
    setSavedName(name)
    setDraft(name)
  }, [name])
  const save = async () => {
    if (saving.current) return
    const parsed = paperRenameInputSchema.safeParse({
      docId,
      name: draft.trim(),
    })
    if (!parsed.success) {
      setError("Enter a document name.")
      return
    }
    if (parsed.data.name === savedName) {
      setEditing(false)
      return
    }
    saving.current = true
    try {
      await run("paper.rename", { ...parsed.data, writer: RICH_NATIVE_WRITER })
      setSavedName(parsed.data.name)
      setEditing(false)
      setError("")
    } catch {
      setError("Could not rename this document. Try again.")
    } finally {
      saving.current = false
    }
  }
  return (
    <div className="paper-document-title" data-slot="paper-document-title">
      <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <FileText className="size-5" aria-hidden="true" />
      </div>
      {editing ? (
        <Input
          autoFocus
          aria-label="Document name"
          aria-invalid={!!error}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void save()
            }
            if (event.key === "Escape") {
              event.preventDefault()
              setDraft(savedName)
              setError("")
              setEditing(false)
            }
          }}
        />
      ) : (
        <h1 aria-label={savedName}>
          <button
            type="button"
            aria-label="Rename document"
            onClick={() => {
              setDraft(savedName)
              setEditing(true)
            }}
          >
            {savedName}
          </button>
        </h1>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PaperDocumentCanvas({
  title,
  children,
}: {
  title?: ReactNode
  children: ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element) return
    const align = () => {
      const page = element.querySelector<HTMLElement>(
        ".paper-rich-sheet, .writing-page"
      )
      if (!page) return
      const box = page.getBoundingClientRect()
      const style = getComputedStyle(page)
      const scale = page.offsetWidth ? box.width / page.offsetWidth : 1
      const values = {
        "--document-width": `${box.width}px`,
        "--document-inset": `${parseFloat(style.paddingLeft) * scale}px`,
        "--document-end": `${parseFloat(style.paddingRight) * scale}px`,
        "--document-top": `${parseFloat(style.paddingTop) * scale}px`,
      }
      for (const [key, value] of Object.entries(values)) {
        if (element.style.getPropertyValue(key) !== value)
          element.style.setProperty(key, value)
      }
    }
    align()
    const mutations = new MutationObserver(align)
    mutations.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    })
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align)
    observer?.observe(element)
    return () => {
      mutations.disconnect()
      observer?.disconnect()
    }
  }, [])
  return (
    <div ref={host} className="paper-document-canvas">
      {title}
      {children}
      <PaperDocumentOutline host={host} />
    </div>
  )
}
