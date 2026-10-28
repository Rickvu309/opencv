import { useCallback, useEffect, useRef, useState } from "react"
import { keywordGap, type JobView, type PaperView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

import { useRunCommand } from "@/lib/contract-client.ts"
import { useQueryClient } from "@tanstack/react-query"

import { getPaper, paperGetKey } from "./paper-api.ts"
import { usePaperAutosave } from "./paper-autosave.ts"
import { PaperEditorConflictBanner } from "./paper-editor-conflict-banner.tsx"
import { PaperLetterArticle } from "./paper-letter-article.tsx"
import { editorEditedLabel } from "./paper-templates.ts"

export { PaperLetterStart } from "./paper-letter-start.tsx"

function caretOffset(node: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  if (!node.contains(selection.anchorNode)) return null
  const range = selection.getRangeAt(0)
  const before = range.cloneRange()
  before.selectNodeContents(node)
  before.setEnd(range.endContainer, range.endOffset)
  return before.toString().length
}

function placeCaret(node: HTMLElement, offset: number) {
  const text = node.firstChild
  if (!text) return
  const range = document.createRange()
  const clamped = Math.max(0, Math.min(offset, text.textContent?.length ?? 0))
  range.setStart(text, clamped)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function markdownOf(document: unknown) {
  if (!document || typeof document !== "object" || !("markdown" in document))
    return ""
  const markdown = (document as { markdown: unknown }).markdown
  return typeof markdown === "string" ? markdown : ""
}

export function PaperLetterEditor({
  doc,
  job,
  cvName,
  onBack,
}: {
  doc: PaperView
  job: JobView | null
  cvName: string | null
  onBack: () => void
}) {
  const run = useRunCommand()
  const queryClient = useQueryClient()
  const editorRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)
  const inputCountRef = useRef(0)
  const [markdown, setMarkdown] = useState(markdownOf(doc.document))
  const [updatedAt, setUpdatedAt] = useState(doc.updatedAt)
  const [hiddenGap, setHiddenGap] = useState(false)
  const [conflict, setConflict] = useState(false)
  const { schedule, adopt, versionRef } = usePaperAutosave<string>({
    docId: doc.id,
    initialVersion: doc.contentVersion,
    toDocument: (next) => ({ markdown: next }),
    readInputEpoch: () => inputCountRef.current,
    onSaved: (saved, inputEpoch) => {
      if (inputEpoch === inputCountRef.current) dirtyRef.current = false
      setUpdatedAt(new Date().toISOString())
      setConflict(false)
      queryClient.setQueryData(paperGetKey(doc.id), saved)
    },
    onConflict: () => setConflict(true),
    onError: (error) => {
      toast(
        error instanceof Error ? error.message : "Could not save. Try again."
      )
    },
  })
  const scheduleRef = useRef(schedule)
  const adoptRef = useRef(adopt)
  useEffect(() => {
    scheduleRef.current = schedule
    adoptRef.current = adopt
  }, [schedule, adopt])
  const caretRef = useRef<number | null>(null)
  const onLetterInput = useCallback(() => {
    const node = editorRef.current
    const next = node?.textContent ?? ""
    inputCountRef.current += 1
    dirtyRef.current = true
    caretRef.current = node ? caretOffset(node) : null
    setMarkdown(next)
    scheduleRef.current(next)
  }, [])
  const gap = hiddenGap
    ? null
    : keywordGap(markdown, job?.posting?.requirements ?? "")

  useEffect(() => {
    if (dirtyRef.current) return
    const next = markdownOf(doc.document)
    // A reload can be newer than the query prop. Leave that text on screen.
    if (doc.contentVersion < versionRef.current) return
    if (doc.contentVersion === versionRef.current && next === markdown) return
    caretRef.current = null
    adoptRef.current(doc.contentVersion)
    setMarkdown(next)
  }, [doc, markdown, versionRef])

  useEffect(() => {
    const node = editorRef.current
    if (!node || node.textContent === markdown) return
    const focused = document.activeElement === node
    if (focused && dirtyRef.current && node.textContent !== "") return
    const offset = focused ? (caretRef.current ?? markdown.length) : null
    node.textContent = markdown
    if (offset != null) placeCaret(node, offset)
  }, [markdown])

  async function reloadLetter() {
    try {
      const next = await getPaper(doc.id)
      const text = markdownOf(next.document)
      dirtyRef.current = false
      caretRef.current = null
      adopt(next.contentVersion)
      queryClient.setQueryData(paperGetKey(doc.id), next)
      setMarkdown(text)
      const node = editorRef.current
      if (node) {
        node.textContent = text
        if (document.activeElement === node) placeCaret(node, text.length)
      }
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

  async function addKeyword() {
    if (!gap) return
    const next = markdown.includes(gap.keyword)
      ? markdown
      : `${markdown}\n${gap.keyword}`
    setMarkdown(next)
    const node = editorRef.current
    if (node) node.textContent = next
    try {
      const saved = await run("paper.replace", {
        docId: doc.id,
        contentVersion: versionRef.current,
        document: { markdown: next },
      })
      versionRef.current = saved.contentVersion
      setUpdatedAt(new Date().toISOString())
      setHiddenGap(true)
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not add that word. Try again."
      )
    }
  }

  return (
    <section
      aria-label={`Editing ${doc.name}`}
      className="flex min-w-0 flex-col gap-4 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="link" onClick={onBack}>
          Paper
        </Button>
        <span className="text-sm text-muted-foreground">Cover letters</span>
        <p className="text-sm text-muted-foreground">
          {editorEditedLabel(updatedAt)}
        </p>
      </div>
      {conflict ? (
        <PaperEditorConflictBanner onReload={() => void reloadLetter()} />
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {cvName ? (
            <p className="mb-2 text-sm text-muted-foreground">From {cvName}</p>
          ) : null}
          <PaperLetterArticle
            doc={doc}
            editorRef={editorRef}
            onInput={onLetterInput}
          />
        </div>
        {gap ? (
          <aside className="flex w-full flex-col gap-2 rounded-lg border border-border p-4 lg:w-72">
            <p className="text-sm font-medium">Missing keyword</p>
            <p className="text-sm">{gap.sentence}</p>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button
                type="button"
                variant="glow"
                onClick={() => void addKeyword()}
              >
                Add to letter
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setHiddenGap(true)}
              >
                Skip
              </Button>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  )
}
