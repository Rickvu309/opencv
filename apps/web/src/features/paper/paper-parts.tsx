import { MoreHorizontal } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { previewTemplate } from "./paper-templates.ts"

export function SectionHead({ children }: { children: string }) {
  return (
    <h2 className="text-sm font-medium text-muted-foreground">{children}</h2>
  )
}

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
  onClick,
  href,
}: {
  title: string
  body: string
  onClick?: () => void
  href?: string
}) {
  const className = cn(
    "flex h-full flex-col items-start gap-1 rounded-lg border border-border bg-card p-4 text-left",
    "hover:bg-muted"
  )
  if (href) {
    return (
      <a href={href} aria-label={title} className={className}>
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{body}</span>
      </a>
    )
  }
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={title}
      className={cn(className, "h-auto whitespace-normal")}
      onClick={onClick}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-sm font-normal text-muted-foreground">{body}</span>
    </Button>
  )
}

export function PaperCard({
  name,
  edited,
  templateId,
  onOpen,
  onRename,
  onDuplicate,
  onLink,
  onDownload,
  onDelete,
}: {
  name: string
  edited: string
  templateId: string
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onLink: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        aria-label={`${name}, ${edited}`}
        className="h-auto w-full flex-col items-stretch gap-2 p-3 text-left whitespace-normal"
        onClick={onOpen}
      >
        <MiniCv templateId={templateId} />
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {edited}
        </span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${name} menu`}
            >
              <MoreHorizontal />
              Menu
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
