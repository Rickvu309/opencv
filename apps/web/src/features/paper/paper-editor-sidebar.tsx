import { cn } from "@workspace/ui/lib/utils"
import { FileText, Search } from "lucide-react"

import { TYPE_LABEL, type PaperDoc } from "./paper-data.ts"

type Props = {
  docs: PaperDoc[]
  activeId: string
  onSelect: (id: string) => void
  onBack: () => void
}

export function PaperEditorSidebar({
  docs,
  activeId,
  onSelect,
  onBack,
}: Props) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All documents
        </button>
        <p className="mt-2 text-sm font-semibold">Documents</p>
      </div>

      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search…"
            className="h-8 w-full rounded-lg border border-border bg-background pr-2 pl-8 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            aria-label="Search documents"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {docs.map((doc) => {
          const active = doc.id === activeId
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => onSelect(doc.id)}
              className={cn(
                "mb-0.5 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
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
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {TYPE_LABEL[doc.kind]}
                  {doc.status === "draft" ? (
                    <span className="rounded bg-muted px-1 py-px text-[10px] font-medium uppercase">
                      Draft
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
