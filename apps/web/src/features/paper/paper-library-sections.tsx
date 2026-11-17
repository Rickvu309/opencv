import { useReducer, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Link2,
  Pencil,
  SquareArrowOutUpRight,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import {
  paperPlainText,
  type PaperFile,
  type PaperView,
} from "@workspace/domain"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"

import {
  PaperLibraryCard,
  type PaperCardAction,
} from "./paper-library-card.tsx"
import { fileBadge, type LibraryEntry } from "./paper-library-entries.ts"
import type { WordDocument } from "./paper-package-library.tsx"
import { paperEditedLabel } from "./paper-templates.ts"

const PREVIEW_LINE_LIMIT = 12

export function librarySheetLines(doc: PaperView): string[] {
  const paper = doc.paper
  if (!paper || (paper.kind !== "cv" && paper.kind !== "letter")) return []
  const name = doc.name.trim()
  return paperPlainText(paper)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== name)
    .slice(0, PREVIEW_LINE_LIMIT)
}

export function PaperProofsLink() {
  return (
    <section
      aria-label="Proofs"
      data-slot="paper-library-section"
      className="flex flex-col gap-2 md:gap-3.5"
    >
      <Link
        to={SURFACE_PATHS.proofs}
        data-slot="paper-library-section-head"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-11 w-full justify-start gap-2 rounded-md px-0 text-sm font-semibold text-foreground hover:bg-transparent aria-expanded:bg-transparent md:h-8"
        )}
      >
        <ChevronRight
          data-slot="paper-library-section-icon"
          className="size-[13px] text-muted-foreground"
        />
        Proofs
      </Link>
    </section>
  )
}

export function PaperLibrarySection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [open, toggle] = useReducer((value: boolean) => !value, true)
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <section
      aria-label={title}
      data-slot="paper-library-section"
      className="flex flex-col gap-2 md:gap-3.5"
    >
      <Button
        type="button"
        variant="ghost"
        data-slot="paper-library-section-head"
        aria-expanded={open}
        className="h-11 w-full justify-start gap-2 rounded-md px-0 text-sm font-semibold text-foreground hover:bg-transparent aria-expanded:bg-transparent md:h-8"
        onClick={toggle}
      >
        <Chevron
          data-slot="paper-library-section-icon"
          className="size-[13px] text-muted-foreground"
          aria-hidden="true"
        />
        {title}
      </Button>
      {open ? (
        <div
          data-slot="paper-library-row"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:flex md:flex-wrap md:gap-7"
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}

export type LibraryEntryHandlers = {
  onOpen: (docId: string) => void
  onPreview: (word: WordDocument) => void
  onRename?: (doc: PaperView) => void
  onDuplicate?: (doc: PaperView) => void
  onLink?: (doc: PaperView) => void
  onDownload?: (doc: PaperView) => void
  onDelete?: (doc: PaperView) => void
  onDeleteFile?: (file: PaperFile) => void
}

export function hasPrintBody(doc: PaperView) {
  return doc.format !== "word"
}

function paperActions(
  doc: PaperView,
  word: WordDocument | null,
  on: LibraryEntryHandlers
): PaperCardAction[] {
  const each = (
    label: string,
    icon: LucideIcon,
    handler: ((doc: PaperView) => void) | undefined
  ) => (handler ? [{ label, icon, onSelect: () => handler(doc) }] : [])
  return [
    {
      label: "Open",
      icon: SquareArrowOutUpRight,
      onSelect: () => on.onOpen(doc.id),
    },
    ...each("Rename", Pencil, on.onRename),
    ...each("Duplicate", Copy, on.onDuplicate),
    ...each("Link to application", Link2, on.onLink),
    ...(hasPrintBody(doc) ? each("Download PDF", Download, on.onDownload) : []),
    ...(word
      ? [
          {
            label: "Preview text",
            icon: FileText,
            onSelect: () => on.onPreview(word),
          },
        ]
      : []),
    ...each("Delete", Trash2, on.onDelete).map((action) => ({
      ...action,
      destructive: true,
    })),
  ]
}

export function LibraryEntryCard({
  entry,
  on,
}: {
  entry: LibraryEntry
  on: LibraryEntryHandlers
}) {
  if (entry.type === "paper") {
    const { doc } = entry
    const edited = paperEditedLabel(doc.updatedAt)
    return (
      <PaperLibraryCard
        name={doc.name}
        meta={edited}
        lines={librarySheetLines(doc)}
        openLabel={`${doc.name}, ${edited}`}
        onOpen={() => on.onOpen(doc.id)}
        actions={paperActions(doc, entry.word, on)}
      />
    )
  }
  if (entry.type === "word") {
    const { word } = entry
    return (
      <PaperLibraryCard
        name={word.name}
        meta="Word file"
        openLabel={`Open ${word.name}`}
        onOpen={() => on.onOpen(word.docId)}
        actions={[
          {
            label: "Open",
            icon: SquareArrowOutUpRight,
            onSelect: () => on.onOpen(word.docId),
          },
          {
            label: "Preview text",
            icon: FileText,
            onSelect: () => on.onPreview(word),
          },
        ]}
      />
    )
  }
  const { file } = entry
  const onDeleteFile = on.onDeleteFile
  return (
    <PaperLibraryCard
      name={file.name}
      meta={paperEditedLabel(file.createdAt)}
      badge={fileBadge(file)}
      actions={
        onDeleteFile
          ? [
              {
                label: "Delete",
                icon: Trash2,
                onSelect: () => onDeleteFile(file),
                destructive: true,
              },
            ]
          : []
      }
    />
  )
}
