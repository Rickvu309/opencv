import { useCallback, useEffect, useRef, useState } from "react"
import {
  emptyCvDocument,
  isCvDocument,
  paperDocNameSchema,
  type CvDocument,
} from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { ApiError } from "@/lib/api-error.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"

import { PaperEditorConflictBanner } from "./paper-editor-conflict-banner.tsx"
import { PaperCvSurface } from "./paper-cv-surface.tsx"
import {
  createPaperChat,
  getPaper,
  keepTwoPages,
  openPaperChat,
  renamePaper,
  replacePaper,
  sharePaper,
  streamPaperTurn,
  type PaperPages,
  type PaperRecord,
} from "./paper-api.ts"
import {
  editorEditedLabel,
  previewTemplate,
  printLayout,
} from "./paper-templates.ts"

function cvOf(document: unknown, templateId: string): CvDocument {
  if (isCvDocument(document)) {
    return {
      ...document,
      templateId: printLayout(document.templateId || templateId),
    }
  }
  return { ...emptyCvDocument(), templateId: printLayout(templateId) }
}

export function PaperCvEditor({
  initial,
  pages,
  onBack,
}: {
  initial: PaperRecord
  pages: PaperPages
  onBack: () => void
}) {
  const versionRef = useRef(initial.contentVersion)
  const pendingRef = useRef<CvDocument | null>(null)
  const timerRef = useRef<number | null>(null)
  const [cv, setCv] = useState(() => cvOf(initial.document, initial.templateId))
  const [name, setName] = useState(initial.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt)
  const [pageState, setPageState] = useState(pages)
  const [conflict, setConflict] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const showBanner = pageState.pages > 1 && pageState.pageChoice === "unset"

  useEffect(() => {
    setPageState((current) => (current.pageChoice === "keep" ? current : pages))
  }, [pages])

  const flush = useCallback(async () => {
    const next = pendingRef.current
    if (!next) return
    pendingRef.current = null
    try {
      const saved = await replacePaper({
        docId: initial.id,
        contentVersion: versionRef.current,
        document: next,
      })
      versionRef.current = saved.contentVersion
      setUpdatedAt(new Date().toISOString())
      setConflict(false)
    } catch (error) {
      pendingRef.current = next
      if (error instanceof ApiError && error.code === "CONFLICT")
        setConflict(true)
      else
        toast(
          error instanceof Error ? error.message : "Could not save. Try again."
        )
    }
  }, [initial.id])

  function schedule(next: CvDocument) {
    pendingRef.current = next
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flush()
    }, 700)
  }

  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])
  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      void flushRef.current()
    }
  }, [])

  async function commitName() {
    const parsed = paperDocNameSchema.safeParse(name.trim())
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? "Name is required")
      return
    }
    setNameError(null)
    if (parsed.data === initial.name) return
    try {
      await renamePaper({ docId: initial.id, name: parsed.data })
    } catch (error) {
      setNameError(
        error instanceof Error ? error.message : "Could not rename. Try again."
      )
    }
  }

  async function copyLink() {
    try {
      const { token } = await sharePaper(initial.id)
      const url = `${window.location.origin}/share/${token}`
      await navigator.clipboard.writeText(url)
      toast("Link copied")
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not copy the link. Try again."
      )
    }
  }

  async function keepPages() {
    try {
      await keepTwoPages(initial.id)
      setPageState((current) => ({ ...current, pageChoice: "keep" }))
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not keep two pages. Try again."
      )
    }
  }

  async function fitOnePage() {
    try {
      const chat = await createPaperChat("Fit to one page")
      await streamPaperTurn({
        chatId: chat.id,
        text: "Tighten this CV so it fits on one page.",
        focusDocId: initial.id,
        onText: () => undefined,
        onToolResult: (tool) => {
          if (tool === "paper.replace" || tool === "paper_replace") {
            void getPaper(initial.id).then((next) => {
              setCv(cvOf(next.document, next.templateId))
              versionRef.current = next.contentVersion
            })
          }
        },
      })
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not ask Coach. Try again."
      )
    }
  }

  function openCoach() {
    document.querySelector<HTMLButtonElement>("[data-dock-coach]")?.click()
    void openPaperChat(initial.id).catch((error: unknown) => {
      toast(
        error instanceof Error
          ? error.message
          : "Could not open Coach. Use the dock Coach button."
      )
    })
  }

  async function download() {
    try {
      const res = await fetch(
        new URL(`/api/paper/${initial.id}/pdf`, apiBaseUrl),
        {
          credentials: "include",
        }
      )
      if (!res.ok) {
        toast("Could not download the PDF. Try again.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${name}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      toast("Could not download the PDF. Try again.")
    }
  }

  async function reload() {
    try {
      const next = await getPaper(initial.id)
      versionRef.current = next.contentVersion
      pendingRef.current = null
      setCv(cvOf(next.document, next.templateId))
      setUpdatedAt(next.updatedAt)
      setConflict(false)
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not reload. Refresh the page."
      )
    }
  }

  return (
    <section
      aria-label={`Editing ${initial.name}`}
      data-paper-editor=""
      className="flex min-w-0 flex-col gap-3 p-4"
    >
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2"
      >
        <Button type="button" variant="link" onClick={onBack}>
          Paper
        </Button>
        <span className="text-sm text-muted-foreground">CVs</span>
        <Input
          aria-label="Document name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void commitName()}
          className="max-w-xs"
        />
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {editorEditedLabel(updatedAt)}
        </p>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={favorite}
          onClick={() => setFavorite((value) => !value)}
        >
          Favorite
        </Button>
        <Button type="button" variant="ghost" onClick={() => void download()}>
          More
        </Button>
        <Button type="button" variant="outline" onClick={() => void copyLink()}>
          Copy link
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => toast("Notifications are not on yet.")}
        >
          Notifications
        </Button>
      </div>
      <div
        className="flex flex-wrap gap-1"
        role="toolbar"
        aria-label="Selection"
      >
        <Button type="button" variant="ghost" size="sm" onClick={openCoach}>
          Coach
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => document.execCommand("bold")}
        >
          Bold
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => document.execCommand("italic")}
        >
          Italic
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => document.execCommand("underline")}
        >
          Underline
        </Button>
      </div>
      {conflict ? (
        <PaperEditorConflictBanner onReload={() => void reload()} />
      ) : null}
      {showBanner ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Over one page</p>
            <p className="text-sm text-muted-foreground">
              Most hiring teams read one page. Coach can tighten it for you.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="glow"
              onClick={() => void fitOnePage()}
            >
              Fit to one page
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void keepPages()}
            >
              Keep 2 pages
            </Button>
          </div>
        </div>
      ) : null}
      <div
        data-template={previewTemplate(initial.templateId)}
        className="min-w-0"
      >
        <PaperCvSurface
          data={cv}
          onChange={(next) => {
            setCv(next)
            schedule(next)
          }}
        />
        {pageState.pages > 1 ? (
          <p className="mt-2 text-sm text-muted-foreground">Page 2</p>
        ) : null}
      </div>
      {nameError ? (
        <p className="text-sm text-destructive">{nameError}</p>
      ) : null}
    </section>
  )
}
