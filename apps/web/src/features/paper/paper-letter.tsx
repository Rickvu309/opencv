import { useCallback, useEffect, useReducer, useRef } from "react"
import {
  compactLetterDocument,
  keywordGap,
  type JobView,
  type LetterDocument,
  type PaperView,
} from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

import { ChevronRight, MessageCircle, X } from "lucide-react"

import "./design/letter-editor.pen.css"
import { useQueryClient } from "@tanstack/react-query"

import { letterOf } from "./letter-sheet-model.ts"
import { getPaper, paperGetKey } from "./paper-api.ts"
import { usePaperAutosave } from "./paper-autosave.ts"
import { PaperPrintSheet } from "./paper-print-sheet.tsx"
import { printPaper } from "./paper-print.ts"
import { PaperEditorConflictBanner } from "./paper-editor-conflict-banner.tsx"
import { letterReducer } from "./paper-letter.reducer.ts"
import { PaperLetterArticle } from "./paper-letter-article.tsx"
import { editorEditedLabel } from "./paper-templates.ts"

export { PaperLetterStart } from "./paper-letter-start.tsx"

function sameLetter(a: LetterDocument, b: LetterDocument) {
  return (
    JSON.stringify(compactLetterDocument(a)) ===
    JSON.stringify(compactLetterDocument(b))
  )
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
  const queryClient = useQueryClient()
  const dirtyRef = useRef(false)
  const inputCountRef = useRef(0)
  const [{ letter, updatedAt, hiddenGap, conflict, printJob }, dispatch] =
    useReducer(letterReducer, {
      letter: letterOf(doc.document),
      updatedAt: doc.updatedAt,
      hiddenGap: false,
      conflict: false,
      printJob: null,
    })
  const { schedule, commitNow, adopt, versionRef } =
    usePaperAutosave<LetterDocument>({
      docId: doc.id,
      initialVersion: doc.contentVersion,
      toDocument: compactLetterDocument,
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
  const onLetterChange = useCallback((next: LetterDocument) => {
    inputCountRef.current += 1
    dirtyRef.current = true
    dispatch({ type: "letter_typed", letter: next })
    scheduleRef.current(next)
  }, [])
  const gap = hiddenGap
    ? null
    : keywordGap(letter.markdown, job?.posting?.requirements ?? "")

  useEffect(() => {
    if (dirtyRef.current) return
    const next = letterOf(doc.document)
    // A reload can be newer than the query prop. Leave that text on screen.
    if (doc.contentVersion < versionRef.current) return
    if (doc.contentVersion === versionRef.current && sameLetter(next, letter))
      return
    adoptRef.current(doc.contentVersion)
    dispatch({ type: "letter_synced", letter: next })
  }, [doc, letter, versionRef])

  useEffect(() => {
    if (!printJob) return
    return printPaper(printJob.title, () =>
      dispatch({ type: "print_finished" })
    )
  }, [printJob])

  async function reloadLetter() {
    try {
      const next = await getPaper(doc.id)
      dirtyRef.current = false
      adopt(next.contentVersion)
      queryClient.setQueryData(paperGetKey(doc.id), next)
      dispatch({
        type: "letter_reloaded",
        letter: letterOf(next.document),
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

  function addKeyword() {
    if (!gap || conflict) return
    const next: LetterDocument = {
      ...letter,
      markdown: letter.markdown.includes(gap.keyword)
        ? letter.markdown
        : `${letter.markdown}\n${gap.keyword}`,
    }
    inputCountRef.current += 1
    dirtyRef.current = true
    dispatch({ type: "keyword_added", letter: next })
    // Share the autosave queue so an in-flight edit advances the version first.
    commitNow(next)
  }

  return (
    <section
      aria-label={`Editing ${doc.name}`}
      data-pen-surface="paper"
      data-slot="letter-editor-page"
      className="flex min-w-0 flex-1 flex-col"
    >
      <header
        data-slot="letter-editor-header"
        className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 border-b py-2 ps-5 pe-4 text-[13.5px] md:h-12 md:flex-nowrap md:py-0"
      >
        <nav
          aria-label="Breadcrumb"
          className="flex w-full min-w-0 flex-none items-center gap-2 md:w-auto md:flex-1"
        >
          <Button
            type="button"
            data-slot="letter-editor-back"
            variant="link"
            className="h-auto p-0 text-[13.5px] font-normal"
            onClick={onBack}
          >
            Paper
          </Button>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="shrink-0">Cover letters</span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          <span aria-current="page" className="truncate">
            {doc.name}
          </span>
        </nav>
        <p
          data-slot="letter-editor-edited"
          className="flex-1 text-[13.5px] leading-4 md:flex-none"
        >
          {editorEditedLabel(updatedAt)}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-8 text-[12px]"
          onClick={() => dispatch({ type: "print_requested", title: doc.name })}
        >
          Download PDF
        </Button>
      </header>
      {printJob ? (
        <PaperPrintSheet
          name={doc.name}
          kind="letter"
          source={compactLetterDocument(letter)}
          templateId={null}
        />
      ) : null}
      {conflict ? (
        <PaperEditorConflictBanner onReload={() => void reloadLetter()} />
      ) : null}
      <div
        data-slot="letter-editor-desk"
        className="@container relative flex min-w-0 flex-1 flex-col items-center gap-4 overflow-auto px-4 pt-6 pb-6"
      >
        {gap ? (
          <aside
            data-slot="letter-editor-suggestion"
            aria-label="Letter suggestion"
            className="flex w-full max-w-[260px] flex-col gap-1.5 rounded-xl border pt-2.5 pr-2.5 pb-3 pl-3.5 @min-[1140px]:absolute @min-[1140px]:[inset-inline-end:30px] @min-[1140px]:[inset-block-start:368px]"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-[13px] leading-[15.5px] font-semibold">
                Missing keyword
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                aria-label="Dismiss suggestion"
                onClick={() => dispatch({ type: "gap_dismissed" })}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <p
              data-slot="letter-editor-suggestion-copy"
              className="pr-2.5 pl-[22px] text-[12px] leading-[17.5px]"
            >
              {gap.sentence}
            </p>
            <div className="flex gap-1 pt-1.5 pl-[22px]">
              <Button
                type="button"
                variant="glow"
                className="h-7 rounded-lg px-2.5 text-[12px] font-semibold"
                disabled={conflict}
                onClick={addKeyword}
              >
                Add to letter
              </Button>
              <Button
                type="button"
                data-slot="letter-editor-skip"
                variant="ghost"
                className="h-7 rounded-lg px-2.5 text-[12px] font-medium"
                onClick={() => dispatch({ type: "gap_dismissed" })}
              >
                Skip
              </Button>
            </div>
          </aside>
        ) : null}
        <PaperLetterArticle
          doc={doc}
          letter={letter}
          onChange={onLetterChange}
        />
      </div>
    </section>
  )
}
