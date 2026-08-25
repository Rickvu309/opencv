/**
 * Paper drive + document editor. Mounts through the Paper route seam.
 */
import { useCallback, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Filter, MoreHorizontal, Plus, Search } from "lucide-react"

import {
  PAPER_SUMMARY,
  TYPE_LABEL,
  seedPaperDocs,
  type DocStatus,
  type PaperDoc,
} from "./paper-data.ts"
import { PaperEditor } from "./paper-editor.tsx"

export function PaperWorkspace() {
  const [docs, setDocs] = useState<PaperDoc[]>(() => seedPaperDocs())
  const [query, setQuery] = useState("")
  const [openDocId, setOpenDocId] = useState<string | null>(null)

  const openDoc = openDocId
    ? (docs.find((doc) => doc.id === openDocId) ?? null)
    : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        TYPE_LABEL[d.type].toLowerCase().includes(q) ||
        (d.applyLink?.toLowerCase().includes(q) ?? false)
    )
  }, [docs, query])

  const handleDocChange = useCallback((next: PaperDoc) => {
    setDocs((prev) => prev.map((doc) => (doc.id === next.id ? next : doc)))
  }, [])

  if (openDoc) {
    return (
      <PaperEditor
        doc={openDoc}
        docs={docs}
        onBack={() => setOpenDocId(null)}
        onSelectDoc={setOpenDocId}
        onChange={handleDocChange}
      />
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#FAFAFA]"
      role="region"
      aria-label="Paper"
    >
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PAPER_SUMMARY.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border bg-background p-4 shadow-sm"
            >
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="h-8 w-full rounded-lg border border-border bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-label="Search documents"
              />
            </div>
            <Button type="button" size="sm" variant="outline">
              <Filter className="size-3.5" />
              Filter
            </Button>
            <Button type="button" size="sm">
              <Plus className="size-3.5" />
              New
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                  <th className="px-4 py-2.5 font-medium">Apply</th>
                  <th className="w-10 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => setOpenDocId(doc.id)}
                    className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {doc.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {TYPE_LABEL[doc.type]}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {doc.updated}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {doc.applyLink ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Row menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "ready" &&
          "border border-border bg-secondary text-secondary-foreground",
        status === "draft" && "bg-muted text-muted-foreground",
        status === "published" &&
          "border border-border bg-muted text-foreground"
      )}
    >
      {status === "ready"
        ? "Ready"
        : status === "published"
          ? "Published"
          : "Draft"}
    </span>
  )
}
