import { useId, useReducer, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  ChevronDown,
  ArrowRight,
  Copy,
  Download,
  FileText,
  Link2,
  Pencil,
  Plus,
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
    <section
      aria-label="Proofs"
      data-slot="paper-library-section"
      className="flex flex-col gap-2"
    >
      <Link
        to={SURFACE_PATHS.proofs}
        data-slot="paper-library-section-head"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-11 w-fit justify-start gap-2 px-0 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground md:h-8"
        )}
      >
        <ArrowRight
          data-slot="paper-library-section-icon"
          className="size-[13px]"
          aria-hidden="true"
        />
        Proofs
      </Link>
    </section>
  )
}

type SectionAction = {
  label: string
  empty: string
  onCreate: () => void
}

export function PaperLibrarySection({
  title,
  count = 0,
  action,
  children,
}: {
  title: string
  count?: number
  action?: SectionAction
  children: ReactNode
}) {
  const [open, toggle] = useReducer((value: boolean) => !value, true)
  const bodyId = useId()
  return (
    <section
      aria-label={title}
      data-slot="paper-library-section"
      className="group/section flex flex-col gap-2 sm:gap-3.5"
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          data-slot="paper-library-section-head"
          aria-label={title}
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          aria-describedby={`${bodyId}-count`}
          className="h-11 justify-start gap-2 px-0 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent md:h-8"
          onClick={toggle}
        >
          <ChevronDown
            data-slot="paper-library-section-icon"
            className={cn("size-[13px]", !open && "-rotate-90")}
            aria-hidden="true"
          />
          {title}
          <span
            className="text-xs font-normal tabular-nums"
            id={`${bodyId}-count`}
          >
            {count}
          </span>
        </Button>
        {action ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={action.label}
            className="size-11 text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/section:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/section:opacity-100 md:[@media(pointer:fine)]:size-8"
            onClick={action.onCreate}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {open ? (
        <div
          id={bodyId}
          data-slot="paper-library-row"
          className={
            count === 0
              ? "flex min-w-0 items-center gap-3 ps-[21px]"
              : "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:flex md:flex-wrap md:gap-7"
          }
        >
          {children}
          {count === 0 && action ? (
            <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              <p>{action.empty}</p>
              <Button
                variant="link"
                className="h-11 px-0 text-sm md:h-8"
                onClick={action.onCreate}
              >
                {action.label}
              </Button>
            </div>
          ) : null}
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
        preview={
          doc.format === "word" ? (
            <PaperWordPreview docId={doc.id} />
          ) : undefined
        }
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
        preview={<PaperWordPreview docId={word.docId} />}
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
