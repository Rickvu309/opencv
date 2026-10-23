import type { RefObject } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { FileText, MoreHorizontal } from "lucide-react"

import type { PaperDoc } from "./paper-data.ts"

type Props = {
  doc: PaperDoc
  editorRef: RefObject<HTMLDivElement | null>
  onInput: () => void
}

export function PaperLetterArticle({ doc, editorRef, onInput }: Props) {
  return (
    <article
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-card shadow-sm",
        doc.status === "draft"
          ? "border-border ring-1 ring-ring/20"
          : "border-border/80"
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-medium text-muted-foreground">
            {doc.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {doc.status === "draft" ? (
            <span className="rounded-md bg-muted px-2 py-0.5 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              Draft
            </span>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="More"
            className="text-muted-foreground"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        suppressContentEditableWarning
        onInput={onInput}
        data-paper-section="letter"
        className="paper-editor-canvas prose-kit min-h-[70vh] px-10 py-10 outline-none sm:px-14 sm:py-12"
        aria-label="Document content"
        spellCheck
      />
    </article>
  )
}
