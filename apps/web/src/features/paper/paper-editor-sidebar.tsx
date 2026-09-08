import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { FileText, Search } from "lucide-react"

import { TYPE_LABEL, type PaperDoc } from "./paper-data.ts"

type Props = {
  id?: string
  docs: PaperDoc[]
  activeId: string
  onSelect: (id: string) => void
  onBack: () => void
  overlay?: boolean
}

export function PaperEditorSidebar({
  id,
  docs,
  activeId,
  onSelect,
  onBack,
  overlay = false,
}: Props) {
  return (
    <aside
      id={id}
      aria-label="Documents"
      data-paper-docs-overlay={overlay ? "" : undefined}
      className={cn(
        "flex w-60 shrink-0 flex-col border-r border-border bg-background",
        overlay && "absolute inset-y-0 left-0 z-10 shadow-sm"
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-auto px-0 text-xs font-medium text-muted-foreground"
        >
          ← All documents
        </Button>
        <p className="mt-2 text-sm font-semibold">Documents</p>
      </div>

      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            className="h-8 pl-8 text-xs"
            aria-label="Search documents"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {docs.map((doc) => {
          const active = doc.id === activeId
          return (
            <Button
              key={doc.id}
              type="button"
              variant="ghost"
              onClick={() => onSelect(doc.id)}
              className={cn(
                "mb-0.5 h-auto w-full items-start justify-start gap-2 px-2.5 py-2 text-left",
                active
                  ? "border-foreground/15 bg-muted font-medium text-foreground"
                  : "border-transparent hover:bg-muted/50"
              )}
            >
              <FileText
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {doc.name}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-micro text-muted-foreground">
                  {TYPE_LABEL[doc.kind]}
                  {doc.status === "draft" ? (
                    <span className="rounded bg-muted px-1 py-px text-2xs font-medium uppercase">
                      Draft
                    </span>
                  ) : null}
                </span>
              </span>
            </Button>
          )
        })}
      </div>
    </aside>
  )
}
