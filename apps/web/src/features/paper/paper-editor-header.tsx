import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { PaperDocStatus } from "@workspace/domain"
import {
  FileText,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
} from "lucide-react"

import { WorkspaceHeader } from "@/components/workspace-header.tsx"

import {
  SAMPLE_CV_LABEL,
  SAMPLE_CV_MAKE_MINE,
  TYPE_LABEL,
  formatPaperUpdated,
  isSampleCv,
  type PaperDoc,
} from "./paper-data.ts"
import { PaperEditorStatusPill } from "./paper-editor-status-pill.tsx"

export const DOCS_PANEL_ID = "paper-docs-panel"

type Props = {
  doc: PaperDoc
  title: string
  onTitleChange: (title: string) => void
  onRename: (name: string) => void
  docsExpanded: boolean
  onToggleDocs: () => void
  onMakeMine: () => void
  onDelete: () => void
  onStatusChange: (status: PaperDocStatus) => void
  dirty: boolean
  saving: boolean
  onSave: () => void
}

export function PaperEditorHeader({
  doc,
  title,
  onTitleChange,
  onRename,
  docsExpanded,
  onToggleDocs,
  onMakeMine,
  onDelete,
  onStatusChange,
  dirty,
  saving,
  onSave,
}: Props) {
  return (
    <WorkspaceHeader
      className="items-center gap-3 px-5 py-3"
      icon={<FileText className="size-4 shrink-0 text-muted-foreground" />}
      title={
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => {
              const name = title.trim()
              if (name && name !== doc.name) onRename(name)
              else onTitleChange(doc.name)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            }}
            className="h-auto w-full truncate border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm"
            aria-label="Document name"
          />
          <p className="paper-editor-chrome-meta text-xs text-muted-foreground">
            {TYPE_LABEL[doc.kind]}
            {isSampleCv(doc) ? ` · ${SAMPLE_CV_LABEL}` : null}
            {" · "}Updated {formatPaperUpdated(doc.updatedAt)}
          </p>
        </div>
      }
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Documents"
        aria-expanded={docsExpanded}
        aria-controls={DOCS_PANEL_ID}
        onClick={onToggleDocs}
      >
        {docsExpanded ? (
          <PanelLeftClose className="size-4" />
        ) : (
          <PanelLeftOpen className="size-4" />
        )}
      </Button>

      {isSampleCv(doc) ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8"
          onClick={onMakeMine}
        >
          {SAMPLE_CV_MAKE_MINE}
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" size="icon-sm" variant="ghost" />}
          aria-label="More"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            {isSampleCv(doc) ? "Clear sample" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PaperEditorStatusPill status={doc.status} onChange={onStatusChange} />

      <Button type="button" size="sm" variant="outline">
        <Share2 className="size-3.5" />
        <span className="max-md:hidden">Share</span>
      </Button>

      <Button
        type="button"
        size="sm"
        disabled={!dirty && !saving}
        onClick={onSave}
      >
        {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
      </Button>
    </WorkspaceHeader>
  )
}
