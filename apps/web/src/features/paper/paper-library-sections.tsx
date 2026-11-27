import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Copy,
  Download,
  Link2,
  Pencil,
  Image,
  SquareArrowOutUpRight,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import {
  type LayoutPage,
  type PaperFile,
  type PaperView,
} from "@workspace/domain/paper-doc"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"

import { PaperSheet, type PaperCardAction } from "./paper-library-card.tsx"
import { PaperFirstPage } from "./paper-first-page.tsx"
import { type LibraryEntry } from "./paper-library-entries.ts"

const PREVIEW_LINE_LIMIT = 12

export function librarySheetLines(doc: PaperView): string[] {
  const name = doc.name.trim()
  return (doc.preview ?? [])
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
  page,
}: {
  entry: Exclude<LibraryEntry, { type: "file" }>
  page: LayoutPage | undefined
}) {
  if (page) return <PaperSheet preview={<PaperFirstPage page={page} />} />
  return <PaperSheet lines={librarySheetLines(entry.doc)} />
}

export type LibraryEntryHandlers = {
  onOpen: (docId: string) => void
  onRename?: (doc: PaperView) => void
  onDuplicate?: (doc: PaperView) => void
  onLink?: (doc: PaperView) => void
  onDownload?: (doc: PaperView) => void
  onDelete?: (doc: PaperView) => void
  onDeleteFile?: (file: PaperFile) => void
}

function hasPrintBody(doc: PaperView) {
  return doc.format === undefined
}

function paperActions(
  doc: PaperView,
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
  if (entry.type === "paper") return paperActions(entry.doc, on)
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
