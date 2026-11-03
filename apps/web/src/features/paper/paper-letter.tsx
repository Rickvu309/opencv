import { useCallback, useEffect, useReducer, useRef } from "react"
import {
  keywordGap,
  paperPlainText,
  type JobView,
  type LetterPaper,
  type PaperDocument,
  type PaperView,
} from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { CopyButton } from "@workspace/ui/components/copy-button"

import {
  ChevronRight,
  Ellipsis,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  X,
} from "lucide-react"

import "./design/letter-editor.pen.css"
import "./design/letter-block-editor.pen.css"

import type { ClientChange } from "@workspace/paper-crdt"

import { SYNC_LABEL, usePaperSync } from "@/lib/paper-sync.ts"
import { setPaperSelection } from "@/lib/paper-selection.ts"
import {
  PaperEditorEngine,
  type PaperEditorHandle,
} from "./paper-editor-engine.tsx"
import { LetterPrint } from "./paper-letter-print.tsx"
import { printPaper } from "./paper-print.ts"
import { editorEditedLabel } from "./paper-templates.ts"
import { useShareLink } from "./paper-share-link.ts"

export { PaperLetterStart } from "./paper-letter-start.tsx"

type EditorState = {
  letter: LetterPaper | null
  editedAt: string
  gapHidden: boolean
  printing: boolean
}

function mergeEditorState(state: EditorState, change: Partial<EditorState>) {
  return { ...state, ...change }
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
  const shareLink = useShareLink(doc.id)
  const { client, status, generation } = usePaperSync(doc.id)
  const editorRef = useRef<PaperEditorHandle>(null)
  const [{ letter, editedAt, gapHidden, printing }, patch] = useReducer(
    mergeEditorState,
    {
      letter: null,
      editedAt: doc.updatedAt,
      gapHidden: false,
      printing: false,
    }
  )

  const onDocument = useCallback(
    (next: PaperDocument | null, change: ClientChange) => {
      if (next?.kind !== "letter") return
      patch({ letter: next })
      if (change === "local") patch({ editedAt: new Date().toISOString() })
    },
    []
  )
  const onSelectedBlocks = useCallback(
    (ids: string[]) => setPaperSelection(doc.id, ids),
    [doc.id]
  )
  useEffect(() => () => setPaperSelection(doc.id, []), [doc.id])
  useEffect(() => {
    if (!printing) return
    return printPaper(doc.name, () => patch({ printing: false }))
  }, [printing, doc.name])

  const gap = gapHidden
    ? null
    : keywordGap(
        letter ? paperPlainText(letter) : "",
        job?.posting?.requirements ?? ""
      )
  function addKeyword() {
    if (gap) editorRef.current?.insertText(gap.keyword)
  }

  return (
    <section
      aria-label={`Editing ${doc.name}`}
      data-pen-surface="paper"
      data-slot="letter-editor-page"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
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
          <span
            aria-current="page"
            className="flex min-w-0 items-center gap-1.5"
          >
            <Mail className="size-[15px] shrink-0" aria-hidden="true" />
            <span className="truncate">{doc.name}</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  data-slot="letter-editor-more"
                  variant="ghost"
                  size="icon"
                  className="size-[26px] shrink-0 rounded-[6px]"
                  aria-label="More"
                >
                  <Ellipsis className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => patch({ printing: true })}>
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        <div className="flex flex-1 items-center gap-1 md:flex-none">
          <p
            data-slot="letter-editor-edited"
            className="flex h-7 flex-1 items-center rounded-[7px] px-2 text-[13.5px] leading-4 md:flex-none"
          >
            {status === "saved" || status === "loading"
              ? editorEditedLabel(editedAt)
              : SYNC_LABEL[status]}
          </p>
          <CopyButton
            data-slot="letter-editor-link"
            value={shareLink}
            copiedMessage="Link copied"
            errorMessage={(error) =>
              error instanceof Error
                ? error.message
                : "Could not copy the link. Try again."
            }
            className="h-7 w-[30px] shrink-0 rounded-[7px] p-0"
            aria-label="Copy share link"
          >
            <LinkIcon className="size-4" aria-hidden="true" />
          </CopyButton>
        </div>
      </header>
      {printing && letter ? <LetterPrint document={letter} /> : null}
      <div
        data-slot="letter-editor-desk"
        tabIndex={-1}
        className="@container relative flex min-h-0 min-w-0 flex-1 flex-col items-center gap-4 overflow-auto px-4 pt-6 pb-6"
      >
        {gap ? (
          <aside
            data-slot="letter-editor-suggestion"
            aria-label="Letter suggestion"
            className="flex w-full max-w-[560px] flex-col gap-1.5 rounded-[12px] border pt-2.5 pr-2.5 pb-3 pl-3.5 @min-[876px]:absolute @min-[876px]:[inset-inline-start:calc(50%+162px)] @min-[876px]:max-w-[260px] @min-[876px]:[inset-block-start:368px] @min-[1128px]:[inset-inline-start:calc(50%+304px)]"
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
                className="size-6 shrink-0 rounded-[6px]"
                aria-label="Dismiss suggestion"
                onClick={() => patch({ gapHidden: true })}
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
                className="h-7 rounded-[7px] px-2.5 text-[12px] font-semibold"
                onClick={addKeyword}
              >
                Add to letter
              </Button>
              <Button
                type="button"
                data-slot="letter-editor-skip"
                variant="ghost"
                className="h-7 rounded-[7px] px-2.5 text-[12px] font-medium"
                onClick={() => patch({ gapHidden: true })}
              >
                Skip
              </Button>
            </div>
          </aside>
        ) : null}
        {gap ? (
          <>
            <span
              aria-hidden="true"
              data-slot="letter-editor-connector"
              className="absolute [inset-inline-start:calc(50%+140px)] z-[1] hidden h-px w-[22px] [inset-block-start:390px] @min-[876px]:block @min-[1128px]:[inset-inline-start:calc(50%+282px)]"
            />
            <span
              aria-hidden="true"
              data-slot="letter-editor-anchor"
              className="absolute [inset-inline-start:calc(50%+135px)] z-[1] hidden size-[7px] rounded-full border-[1.5px] [inset-block-start:387px] @min-[876px]:block @min-[1128px]:[inset-inline-start:calc(50%+277px)]"
            />
          </>
        ) : null}
        <article
          aria-label={doc.name}
          data-slot="letter-editor-sheet"
          className="w-full max-w-[560px] shrink-0 rounded-[2px] @min-[876px]:-translate-x-[142px] @min-[1128px]:translate-x-0"
        >
          <div data-paper-section="letter">
            {client ? (
              <PaperEditorEngine
                kind="letter"
                client={client}
                generation={generation}
                label={`Letter ${doc.name}`}
                onDocument={onDocument}
                onSelectedBlocks={onSelectedBlocks}
                handleRef={editorRef}
              />
            ) : (
              <p
                role="status"
                className="px-15 py-14 text-[11px] text-muted-foreground"
              >
                {status === "offline"
                  ? "Offline. Retrying to open this letter."
                  : status === "refused"
                    ? SYNC_LABEL.refused
                    : "Connecting"}
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
