import { MoreHorizontal } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { PaperDocStatus } from "@workspace/domain"

import { SAMPLE_CV_MAKE_MINE, isSampleCv, type PaperDoc } from "./paper-data.ts"

const STATUSES: PaperDocStatus[] = ["draft", "ready", "published"]

function statusLabel(status: PaperDocStatus) {
  return status === "ready"
    ? "Ready"
    : status === "published"
      ? "Published"
      : "Draft"
}

export type RowMenuProps = {
  doc: PaperDoc
  onMakeMine: () => void
  onRename: () => void
  onStatus: (status: PaperDocStatus) => void
  onLink: () => void
  onDelete: () => void
}

export function RowMenu({
  doc,
  onMakeMine,
  onRename,
  onStatus,
  onLink,
  onDelete,
}: RowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${doc.name}`}
        className="text-muted-foreground hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-44"
        onClick={(e) => e.stopPropagation()}
      >
        {isSampleCv(doc) ? (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onMakeMine()
            }}
          >
            {SAMPLE_CV_MAKE_MINE}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onRename()
          }}
        >
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onLink()
          }}
        >
          {doc.applyCardId ? "Change Apply link" : "Link to Apply"}
        </DropdownMenuItem>
        {STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={(e) => {
              e.stopPropagation()
              onStatus(status)
            }}
          >
            Mark as {statusLabel(status)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          {isSampleCv(doc) ? "Clear sample" : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StatusBadge({ status }: { status: PaperDocStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "ready" &&
          "border border-border bg-secondary text-secondary-foreground",
        status === "draft" &&
          "border border-border bg-background text-muted-foreground",
        status === "published" &&
          "border border-border bg-muted text-foreground"
      )}
    >
      {statusLabel(status)}
    </span>
  )
}
