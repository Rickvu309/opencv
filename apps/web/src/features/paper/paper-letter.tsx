import { useCallback, useEffect, useReducer, useRef } from "react"
import { keywordGap, type JobView, type PaperView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

import { useRunCommand } from "@/lib/contract-client.ts"
import { useQueryClient } from "@tanstack/react-query"

import { getPaper, paperGetKey } from "./paper-api.ts"
import { usePaperAutosave } from "./paper-autosave.ts"
import { PaperPrintSheet } from "./paper-print-sheet.tsx"
import { printPaper } from "./paper-print.ts"
import { PaperEditorConflictBanner } from "./paper-editor-conflict-banner.tsx"
import { letterReducer } from "./paper-letter.reducer.ts"
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

  onBack,
}: {
  doc: PaperView
  job: JobView | null

  onBack: () => void
}) {
  const run = useRunCommand()
  const queryClient = useQueryClient()
  const editorRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)
  const inputCountRef = useRef(0)
  const [{ markdown, updatedAt, hiddenGap, conflict, printJob }, dispatch] =
    useReducer(letterReducer, {
      markdown: markdownOf(doc.document),
      updatedAt: doc.updatedAt,
      hiddenGap: false,
      conflict: false,
      printJob: null,
    })
  const { schedule, adopt, versionRef } = usePaperAutosave<string>({
    docId: doc.id,
    initialVersion: doc.contentVersion,
    toDocument: (next) => ({ markdown: next }),
    readInputEpoch: () => inputCountRef.current,
    onSaved: (saved, inputEpoch) => {
      if (inputEpoch === inputCountRef.current) dirtyRef.current = false
      dispatch({ type: "saved", at: new Date().toISOString() })
      queryClient.setQueryData(paperGetKey(doc.id), saved)
    },
    onConflict: () => dispatch({ type: "conflict_detected" }),
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
    dispatch({ type: "letter_typed", markdown: next })
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
    dispatch({ type: "letter_synced", markdown: next })
  }, [doc, markdown, versionRef])

  useEffect(() => {
    if (!printJob) return
    return printPaper(printJob.title, () =>
      dispatch({ type: "print_finished" })
    )
  }, [printJob])

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
      const node = editorRef.current
      if (node) {
        node.textContent = text
        if (document.activeElement === node) placeCaret(node, text.length)
      }
      dispatch({
        type: "letter_reloaded",
        markdown: text,
        updatedAt: next.updatedAt,
      })
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
    dispatch({ type: "keyword_added", markdown: next })
    const node = editorRef.current
    if (node) node.textContent = next
    try {
      const saved = await run("paper.replace", {
        docId: doc.id,
        contentVersion: versionRef.current,
        document: { markdown: next },
      })
      versionRef.current = saved.contentVersion
      dispatch({ type: "keyword_saved", at: new Date().toISOString() })
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
        <Button
          type="button"
          variant="outline"
          onClick={() => dispatch({ type: "print_requested", title: doc.name })}
        >
          Download PDF
        </Button>
      </div>
      {printJob ? (
        <PaperPrintSheet
          name={doc.name}
          kind="letter"
          source={{ markdown }}
          templateId={null}
        />
      ) : null}
      {conflict ? (
        <PaperEditorConflictBanner onReload={() => void reloadLetter()} />
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
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
                onClick={() => dispatch({ type: "gap_dismissed" })}
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
