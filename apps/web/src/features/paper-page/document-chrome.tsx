import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useReducer,
  type ReactNode,
  type Ref,
  type MouseEvent,
  type CSSProperties,
} from "react"
import { FileText } from "lucide-react"
import { paperRenameInputSchema, RICH_NATIVE_WRITER } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useRunCommand } from "@/lib/contract-client.ts"
import { PageHeader } from "@workspace/ui/components/page-header"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
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
    <PageHeader data-slot="writing-document-header">
      <Breadcrumb className="paper-document-breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="/paper"
              aria-label="Back to Paper"
              onClick={back}
            >
              Paper
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              href={kind === "cv" ? "/paper?tab=cvs" : "/paper?tab=letters"}
              onClick={back}
            >
              {kind === "cv" ? "CVs" : "Letters"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage icon={<FileText />} title={name}>
              {name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
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
    </PageHeader>
  )
}

const TitleLayout = createContext<CSSProperties>({})

export function PaperDocumentTitle({
  name,
  docId,
}: {
  name: string
  docId: string
}) {
  const layout = useContext(TitleLayout)
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
  const [pending, setPending] = useReducer(
    (_: boolean, next: boolean) => next,
    false
  )
  const saving = useRef(false)
  useEffect(() => {
    setSavedName(name)
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
    setPending(true)
    try {
      await run("paper.rename", { ...parsed.data, writer: RICH_NATIVE_WRITER })
      setSavedName(parsed.data.name)
      setEditing(false)
      setError("")
    } catch {
      setError("Could not rename this document. Try again.")
    } finally {
      saving.current = false
      setPending(false)
    }
  }
  return (
    <div
      className="paper-document-title"
      data-slot="paper-document-title"
      style={layout}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <FileText className="size-5" aria-hidden="true" />
      </div>
      {editing ? (
        <Input
          autoFocus
          aria-label="Document name"
          aria-invalid={!!error}
          value={draft}
          disabled={pending}
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
          <Button
            variant="ghost"
            className="h-11 max-w-full justify-start p-0 whitespace-normal md:h-auto"
            aria-label="Rename document"
            onClick={() => {
              setDraft(savedName)
              setEditing(true)
            }}
          >
            {savedName}
          </Button>
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
  const [layout, setLayout] = useReducer(
    (previous: CSSProperties, next: CSSProperties) =>
      previous.width === next.width &&
      previous.paddingInlineStart === next.paddingInlineStart &&
      previous.paddingInlineEnd === next.paddingInlineEnd &&
      previous.marginBlockEnd === next.marginBlockEnd
        ? previous
        : next,
    {}
  )
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
      setLayout({
        width: `${box.width}px`,
        paddingInlineStart: `${parseFloat(style.paddingLeft) * scale}px`,
        paddingInlineEnd: `${parseFloat(style.paddingRight) * scale}px`,
        marginBlockEnd: `calc(2rem - ${parseFloat(style.paddingTop) * scale}px)`,
      })
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
      <TitleLayout value={layout}>{title}</TitleLayout>
      {children}
      <PaperDocumentOutline host={host} />
    </div>
  )
}
