import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Copy,
  Download,
  File,
  FileText,
  Link2,
  Pencil,
  Image,
  SquareArrowOutUpRight,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import {
  paperPlainText,
  type PaperFile,
  type PaperView,
} from "@workspace/domain"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"

import {
  PaperLibraryCard,
  PaperSheet,
  type PaperCardAction,
} from "./paper-library-card.tsx"
import { fileBadge, type LibraryEntry } from "./paper-library-entries.ts"
import type { WordDocument } from "./paper-package-library.tsx"
import { PaperWordPreview } from "./paper-word-preview.tsx"
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
    <section aria-label="Proofs" data-slot="paper-library-section">
      <div className="paper-library-empty">
        <Image aria-hidden="true" />
        <h3>Proofs have their own page</h3>
        <p>
          Paper keeps your CVs and letters. Proofs keep the work that backs them
          up.
        </p>
        <Link
          to={SURFACE_PATHS.proofs}
          className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
        >
          Open Proofs <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

export function LibraryDocumentSheet({
  entry,
}: {
  entry: Exclude<LibraryEntry, { type: "file" }>
}) {
  if (entry.type === "word")
    return (
      <PaperSheet preview={<PaperWordPreview docId={entry.word.docId} />} />
    )
  const { doc } = entry
  return (
    <PaperSheet
      lines={librarySheetLines(doc)}
      preview={
        doc.format === "word" ? <PaperWordPreview docId={doc.id} /> : undefined
      }
    />
  )
}

export type LibraryEntryHandlers = {
  onOpen: (docId: string) => void
  onPreview: (word: WordDocument) => void
  onRename?: (doc: PaperView) => void
  onDuplicate?: (doc: PaperView) => void
  onLink?: (doc: PaperView) => void
  onDownload?: (doc: PaperView) => void
  onDownloadWord?: (word: WordDocument) => void
  onDelete?: (doc: PaperView) => void
  onDeleteFile?: (file: PaperFile) => void
}

function hasPrintBody(doc: PaperView) {
  return doc.format === undefined
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
  const downloadWord = on.onDownloadWord
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
    ...(word && downloadWord
      ? [
          {
            label: "Download Word",
            icon: Download,
            onSelect: () => downloadWord(word),
          },
        ]
      : []),
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

export function libraryEntryActions(
  entry: LibraryEntry,
  on: LibraryEntryHandlers
): PaperCardAction[] {
  if (entry.type === "paper") return paperActions(entry.doc, entry.word, on)
  if (entry.type === "word") {
    const { word } = entry
    const downloadWord = on.onDownloadWord
    return [
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
      ...(downloadWord
        ? [
            {
              label: "Download Word",
              icon: Download,
              onSelect: () => downloadWord(word),
            },
          ]
        : []),
    ]
  }
  const onDeleteFile = on.onDeleteFile
  if (!onDeleteFile) return []
  return [
    {
      label: "Delete",
      icon: Trash2,
      onSelect: () => onDeleteFile(entry.file),
      destructive: true,
    },
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
        badge={doc.kind === "cv" ? "CV" : "Letter"}
        lines={librarySheetLines(doc)}
        preview={
          doc.format === "word" ? (
            <PaperWordPreview docId={doc.id} />
          ) : undefined
        }
        openLabel={`${doc.name}, ${edited}`}
        onOpen={() => on.onOpen(doc.id)}
        actions={libraryEntryActions(entry, on)}
      />
    )
  }
  if (entry.type === "word") {
    const { word } = entry
    return (
      <PaperLibraryCard
        name={word.name}
        meta="Word file"
        badge={word.kind === "cv" ? "CV" : "Letter"}
        preview={<PaperWordPreview docId={word.docId} />}
        openLabel={`Open ${word.name}`}
        onOpen={() => on.onOpen(word.docId)}
        actions={libraryEntryActions(entry, on)}
      />
    )
  }
  const { file } = entry
  return (
    <PaperLibraryCard
      name={file.name}
      meta={paperEditedLabel(file.createdAt)}
      badge={fileBadge(file)}
      preview={
        <File
          className="absolute top-1/2 left-1/2 size-8 -translate-1/2 text-muted-foreground"
          strokeWidth={1.5}
        />
      }
      actions={libraryEntryActions(entry, on)}
    />
  )
}
