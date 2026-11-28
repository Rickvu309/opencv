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
import {
  paperRenameInputSchema,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useQueryClient } from "@tanstack/react-query"
import { catalogClient } from "@/lib/contract-client.ts"
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
import { useDocumentEdited } from "./document-edited.ts"
import "./document-chrome.css"

export function PaperDocumentHeader({
  name,
  kind = "cv",
  onBack,
  status,
  editedAt,
  editableName,
  menu,
  actions,
  statusRef,
}: {
  name: string
  kind?: "cv" | "letter"
  onBack?: () => void
  status: string
  editedAt: string | null
  editableName?: ReactNode
  menu?: ReactNode
  actions?: ReactNode
  statusRef?: Ref<HTMLParagraphElement>
}) {
  const edited = useDocumentEdited(status, editedAt)
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
          <BreadcrumbItem
            aria-current="page"
            className="flex min-w-0 items-center gap-1.5"
          >
            {editableName ?? (
              <BreadcrumbPage icon={<FileText />} title={name}>
                {name}
              </BreadcrumbPage>
            )}
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
          {status === "Saved" && edited ? (
            <>
              <span>{edited}</span>
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
  const queryClient = useQueryClient()
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
      await catalogClient.run(queryClient, "paper.update", {
        docId: parsed.data.docId,
        writer: RICH_NATIVE_WRITER,
        patch: { name: parsed.data.name },
      })
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

const RULER_CM = 21.59

export function PaperDocumentRuler() {
  const { width } = useContext(TitleLayout)
  if (!width) return null
  const marks: ReactNode[] = []
  for (let halfCm = 1; halfCm <= Math.round(RULER_CM * 2); halfCm++) {
    const place = `${(halfCm / 2 / RULER_CM) * 100}%`
    const whole = halfCm % 2 === 0
    marks.push(
      <span
        key={`t${halfCm}`}
        data-paper-ruler-tick={whole ? "major" : "minor"}
        style={{ insetInlineStart: place }}
      />
    )
    if (whole) {
      marks.push(
        <span
          key={`n${halfCm}`}
          data-paper-ruler-number=""
          style={{ insetInlineStart: place }}
        >
          {halfCm / 2}
        </span>
      )
    }
  }
  return (
    <div
      aria-hidden="true"
      data-slot="paper-ruler"
      className="paper-document-ruler"
      style={{ width }}
    >
      {marks}
    </div>
  )
}

export function PaperDocumentCanvas({
  title,
  ruler,
  children,
}: {
  title?: ReactNode
  ruler?: ReactNode
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
      <TitleLayout value={layout}>
        {title}
        {ruler}
      </TitleLayout>
      {children}
      <PaperDocumentOutline host={host} />
    </div>
  )
}
