import { memo, type RefObject } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { FileText, MoreHorizontal } from "lucide-react"

import type { PaperView } from "@workspace/domain"

type Props = {
  doc: Pick<PaperView, "name" | "status">
  editorRef: RefObject<HTMLDivElement | null>
  onInput: () => void
}

export const PaperLetterArticle = memo(function PaperLetterArticle({
  doc,
  editorRef,
  onInput,
}: Props) {
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
            <Badge variant="secondary" className="uppercase">
              Draft
            </Badge>
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
        contentEditable="plaintext-only"
        role="textbox"
        suppressContentEditableWarning
        onInput={onInput}
        data-paper-section="letter"
        className="paper-editor-canvas min-h-[70vh] px-10 py-10 text-sm leading-relaxed outline-none sm:px-14 sm:py-12"
        aria-label="Letter text"
        spellCheck
      />
    </article>
  )
})
