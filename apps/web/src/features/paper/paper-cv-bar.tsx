import { Bell, Ellipsis, LayoutTemplate, Link2, Star } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { CopyButton } from "@workspace/ui/components/copy-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderLeading,
  PageHeaderMeta,
} from "@workspace/ui/components/page-header"
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
    <>
      <PageHeader>
        <PageHeaderLeading>
          <PageHeaderBack
            href="/paper"
            onClick={(event) => {
              event.preventDefault()
              onBack()
            }}
          >
            Paper
          </PageHeaderBack>
        </PageHeaderLeading>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/paper"
                onClick={(event) => {
                  event.preventDefault()
                  onBack()
                }}
              >
                Paper
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>CVs</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Input
                aria-label="Document name"
                value={name}
                onChange={(event) => onName(event.target.value)}
                onBlur={() => onCommitName()}
                className="h-11 w-40 min-w-32 shrink-0 border-transparent bg-transparent shadow-none md:h-7"
              />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeaderMeta>{statusLabel}</PageHeaderMeta>
        <PageHeaderActions>
          <PageHeaderAction
            label="Favorite"
            pressed={favorite}
            disabled={favoritePending}
            onSelect={onFavorite}
            icon={<Star className={favorite ? "fill-current" : undefined} />}
          />
          <CopyButton
            value={shareLink}
            copiedMessage="Link copied"
            errorMessage={(error) =>
              error instanceof Error
                ? error.message
                : "Could not copy the link. Try again."
            }
            aria-label="Copy link"
            className="size-11 md:size-7"
          >
            <Link2 className="size-4" />
          </CopyButton>
          <PageHeaderAction
            label="Change template"
            icon={<LayoutTemplate />}
            onSelect={onGallery}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="More"
                  className="size-11 md:size-7"
                >
                  <Ellipsis className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onPrint}>
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PageHeaderAction
            label="Notifications"
            icon={<Bell />}
            onSelect={() => toast("Notifications are not on yet.")}
          />
        </PageHeaderActions>
      </PageHeader>
      <div
        role="toolbar"
        aria-label="Selection"
        className="flex flex-wrap gap-1 px-4 pt-4"
      >
        <Button
          type="button"
          variant="ghost"
          className="h-11 md:h-7"
          onClick={onCoach}
        >
          Coach
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 md:h-7"
          onClick={onUndo}
        >
          Undo
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 md:h-7"
          onClick={onPrint}
        >
          Download PDF
        </Button>
      </div>
    </>
  )
}
