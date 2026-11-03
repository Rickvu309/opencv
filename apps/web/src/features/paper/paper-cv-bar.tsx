import {
  Bell,
  ChevronRight,
  Ellipsis,
  FileText,
  Link2,
  SlidersHorizontal,
  Star,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { CopyButton } from "@workspace/ui/components/copy-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { SYNC_LABEL, type SyncStatus } from "@/lib/paper-sync.ts"

import { editorEditedLabel } from "./paper-templates.ts"

export function cvEditorStatus(
  status: SyncStatus,
  editedAt: string,
  deferring: boolean
) {
  if (
    status === "saved" ||
    status === "loading" ||
    (status === "saving" && deferring)
  ) {
    return editorEditedLabel(editedAt)
  }
  return SYNC_LABEL[status]
}

export function CvEditorBar({
  name,
  favorite,
  favoritePending,
  shareLink,
  statusLabel,
  onBack,
  onName,
  onCommitName,
  onFavorite,
  onGallery,
  onPrint,
  onCoach,
  onUndo,
}: {
  name: string
  favorite: boolean
  favoritePending: boolean
  shareLink: string | (() => string | Promise<string>)
  statusLabel: string
  onBack: () => void
  onName: (name: string) => void
  onCommitName: () => void
  onFavorite: () => void
  onGallery: () => void
  onPrint: () => void
  onCoach: () => void
  onUndo: () => void
}) {
  return (
    <header
      data-slot="cv-editor-header"
      className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 border-b py-2 ps-5 pe-4 text-[13.5px] leading-4 md:h-12 md:flex-nowrap md:py-0"
    >
      <nav
        aria-label="Breadcrumb"
        className="flex w-full min-w-0 flex-none items-center gap-2 md:w-auto"
      >
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-[13.5px] leading-4 font-normal max-md:min-h-11"
          onClick={onBack}
        >
          Paper
        </Button>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="shrink-0">CVs</span>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        <span aria-current="page" className="flex min-w-0 items-center gap-1.5">
          <FileText className="size-[15px] shrink-0" aria-hidden="true" />
          <span className="inline-grid items-center">
            <span
              aria-hidden="true"
              className="invisible col-start-1 row-start-1 px-0 whitespace-pre"
            >
              {name || "Name"}
            </span>
            <Input
              size={1}
              aria-label="Document name"
              value={name}
              onChange={(event) => onName(event.target.value)}
              onBlur={() => onCommitName()}
              className="col-start-1 row-start-1 h-4 w-full min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-[13.5px] leading-4 shadow-none focus-visible:border-transparent focus-visible:ring-0 max-md:h-11 md:text-[13.5px]"
            />
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Favorite"
          aria-pressed={favorite}
          disabled={favoritePending}
          className="size-[26px] shrink-0 rounded-[6px] p-0 max-md:size-11"
          onClick={onFavorite}
        >
          <Star
            className={favorite ? "size-[15px] fill-current" : "size-[15px]"}
            aria-hidden="true"
          />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="More"
                className="size-[26px] shrink-0 rounded-[6px] p-0 max-md:size-11"
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onPrint}>Download PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <div
        role="toolbar"
        aria-label="Selection"
        className="flex min-w-0 flex-1 items-center justify-end gap-1"
      >
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-2 md:h-7"
          onClick={onUndo}
        >
          Undo
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-2 md:h-7"
          onClick={onPrint}
        >
          Download PDF
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-2 md:h-7"
          onClick={onCoach}
        >
          Coach
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-[7px]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Change template"
            className="size-[15px] shrink-0 rounded-none p-0 max-md:size-11"
            onClick={onGallery}
          >
            <SlidersHorizontal className="size-[15px]" aria-hidden="true" />
          </Button>
          <p data-slot="cv-editor-edited" className="leading-4">
            {statusLabel}
          </p>
        </div>
        <CopyButton
          value={shareLink}
          copiedMessage="Link copied"
          errorMessage={(error) =>
            error instanceof Error
              ? error.message
              : "Could not copy the link. Try again."
          }
          aria-label="Copy link"
          className="size-[26px] shrink-0 rounded-[6px] p-0 max-md:size-11"
        >
          <Link2 className="size-4" aria-hidden="true" />
        </CopyButton>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="size-[26px] shrink-0 rounded-[6px] p-0 max-md:size-11"
          onClick={() => toast("Notifications are not on yet.")}
        >
          <Bell className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
