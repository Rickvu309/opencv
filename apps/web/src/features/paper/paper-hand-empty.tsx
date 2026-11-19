import { CircleAlert, File, Search } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import type { LibraryView } from "./paper-library-entries.ts"
import { PaperLetterArt } from "./paper-letter-art.tsx"
import { TemplatePage } from "./paper-template-thumb.tsx"

import "./design/paper-hand-caption.css"

type EmptyAction = { label: string; primary: boolean; onSelect: () => void }

type EmptyCopy = {
  art: "cv" | "letter" | "file" | "search"
  title: string
  why: string
  action: EmptyAction | null
}

const VIEW_WORDS: Partial<Record<LibraryView, string>> = {
  cv: "CVs",
  letter: "letters",
  files: "files",
}

export function emptyHandCopy({
  view,
  query,
  elsewhere,
  onClearSearch,
  onSearchAll,
  onNewCV,
  onNewLetter,
  onOpenImport,
}: {
  view: LibraryView
  query: string
  elsewhere: number
  onClearSearch: () => void
  onSearchAll: () => void
  onNewCV: () => void
  onNewLetter: () => void
  onOpenImport: () => void
}): EmptyCopy {
  const trimmed = query.trim()
  const word = VIEW_WORDS[view]
  if (trimmed !== "" && word && elsewhere > 0)
    return {
      art: "search",
      title: `No ${word} match “${trimmed}”`,
      why:
        elsewhere === 1
          ? "1 other document does."
          : `${elsewhere} other documents do.`,
      action: {
        label: "Search all documents",
        primary: false,
        onSelect: onSearchAll,
      },
    }
  if (trimmed !== "")
    return {
      art: "search",
      title: `Nothing matches “${trimmed}”`,
      why: "Check the spelling, or try fewer letters.",
      action: {
        label: "Show all documents",
        primary: false,
        onSelect: onClearSearch,
      },
    }
  if (view === "cv")
    return {
      art: "cv",
      title: "No CVs yet",
      why: "Start one from a template, or import the CV you have.",
      action: { label: "New CV", primary: true, onSelect: onNewCV },
    }
  if (view === "letter")
    return {
      art: "letter",
      title: "No letters yet",
      why: "Write one for a job you want. Coach can draft it from your CV.",
      action: { label: "New Letter", primary: true, onSelect: onNewLetter },
    }
  return {
    art: "file",
    title: "No files yet",
    why: "Word and PDF files you import land here.",
    action: { label: "Import a file", primary: true, onSelect: onOpenImport },
  }
}

function EmptyArt({ art }: { art: EmptyCopy["art"] }) {
  if (art === "cv") return <TemplatePage templateId="modern" className="" />
  if (art === "letter") return <PaperLetterArt />
  const Icon = art === "search" ? Search : File
  return (
    <span className="paper-picture paper-hand-slot-blank">
      <Icon strokeWidth={1.4} />
    </span>
  )
}

export function PaperHandEmpty({ copy }: { copy: EmptyCopy }) {
  return (
    <>
      <div className="paper-hand-slot-box" aria-hidden="true">
        <span className="paper-hand-slot">
          <EmptyArt art={copy.art} />
        </span>
      </div>
      <div className="paper-hand-caption" aria-live="polite">
        <span className="paper-hand-caption-name">{copy.title}</span>
        <span className="paper-hand-caption-why">{copy.why}</span>
        {copy.action ? (
          <Button
            type="button"
            size="sm"
            variant={copy.action.primary ? "primary" : "outline"}
            className="paper-hand-empty-action h-11 md:h-8"
            onClick={copy.action.onSelect}
          >
            {copy.action.label}
          </Button>
        ) : null}
      </div>
    </>
  )
}

export function PaperHandLoading() {
  return (
    <div className="paper-hand-stage">
      <div className="paper-hand-slot-box is-loading" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span key={index} className="paper-hand-slot" data-at={index}>
            <span className="paper-picture paper-hand-slot-blank" />
          </span>
        ))}
      </div>
      <div className="paper-hand-caption">
        <p role="status" className="paper-hand-caption-why">
          Loading documents…
        </p>
      </div>
    </div>
  )
}

export function PaperHandError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="paper-hand-stage">
      <div className="paper-hand-slot-box" aria-hidden="true">
        <span className="paper-hand-slot">
          <span className="paper-picture paper-hand-slot-blank">
            <CircleAlert strokeWidth={1.4} />
          </span>
        </span>
      </div>
      <div className="paper-hand-caption">
        <span className="paper-hand-caption-name">
          Couldn&apos;t load your documents
        </span>
        <p role="alert" className="paper-hand-caption-why text-destructive">
          {message}
        </p>
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="paper-hand-empty-action h-11 md:h-8"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    </div>
  )
}
