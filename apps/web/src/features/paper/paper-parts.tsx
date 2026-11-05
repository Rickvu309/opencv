import { FileText, MoreHorizontal, Upload, type LucideIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { previewTemplate } from "./paper-templates.ts"

export function MiniCv({ templateId }: { templateId: string }) {
  return (
    <div
      data-template={previewTemplate(templateId)}
      className="aspect-[1/1.294] overflow-hidden rounded-md border border-border bg-card p-3"
    >
      <div className="space-y-1.5" aria-hidden="true">
        <div className="h-1.5 w-2/3 rounded-full bg-muted" />
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted" />
        <div className="h-1.5 w-4/5 rounded-full bg-muted" />
        <div className="h-1.5 w-3/5 rounded-full bg-muted" />
      </div>
    </div>
  )
}

export function NewPaperCard({
  title,
  body,
  icon: Icon = FileText,
  onClick,
}: {
  title: string
  body: string
  icon?: LucideIcon
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={title}
      className="h-36 min-w-0 flex-col items-start justify-between rounded-lg bg-card p-4 text-left whitespace-normal"
      onClick={onClick}
    >
      <Icon className="text-muted-foreground" aria-hidden="true" />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {body}
        </span>
      </span>
    </Button>
  )
}

export function PaperLibraryStarters({
  onCv,
  onLetter,
  onImport,
}: {
  onCv: () => void
  onLetter: () => void
  onImport: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-medium">Start a document</h2>
        <p className="text-sm text-muted-foreground">
          Pick a page, or bring a file you already have.
        </p>
      </div>
      <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        <NewPaperCard title="CV" body="A page you can send." onClick={onCv} />
        <NewPaperCard
          title="Cover letter"
          body="A letter for one job."
          onClick={onLetter}
        />
        <NewPaperCard
          title="Import"
          body="Bring an existing file."
          icon={Upload}
          onClick={onImport}
        />
      </div>
    </div>
  )
}

export function PaperCard({
  name,
  edited,
  kind,
  onOpen,
  onRename,
  onDuplicate,
  onLink,
  onDownload,
  onDelete,
}: {
  name: string
  edited: string
  kind: "CV" | "Cover letter"
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onLink: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  return (
    <div className="relative min-w-0">
      <Button
        type="button"
        variant="outline"
        aria-label={`${name}, ${edited}`}
        className="h-36 w-full min-w-0 flex-col items-start justify-between rounded-lg bg-card p-4 text-left whitespace-normal"
        onClick={onOpen}
      >
        <FileText className="text-muted-foreground" aria-hidden="true" />
        <span className="flex w-full min-w-0 flex-col gap-1">
          <span className="line-clamp-2 text-sm font-medium break-words">
            {name}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {kind} · {edited}
          </span>
        </span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2"
              aria-label={`${name} menu`}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={onLink}>
            Link to application
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDownload}>Download PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function PaperFileCard({
  name,
  onDelete,
}: {
  name: string
  onDelete: () => void
}) {
  return (
    <div className="relative flex h-36 min-w-0 flex-col items-start justify-between rounded-lg border border-border bg-card p-4">
      <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
      <div className="flex w-full min-w-0 flex-col gap-1">
        <span className="line-clamp-2 text-sm font-medium break-words">
          {name}
        </span>
        <span className="text-xs text-muted-foreground">Imported file</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2"
              aria-label={`${name} menu`}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
