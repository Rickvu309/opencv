/**
 * Paper drive + document editor. Mounts through the Paper route seam.
 */
import { useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import type {
  PaperContentKind,
  PaperDoc,
  PaperDocStatus,
} from "@workspace/domain"
import { Filter, MoreHorizontal, Plus, Search } from "lucide-react"

import { TYPE_LABEL, formatPaperUpdated, paperSummary } from "./paper-data.ts"
import { PaperEditor } from "./paper-editor.tsx"
import { usePaperDocs } from "./use-paper-docs.ts"

const STATUSES: PaperDocStatus[] = ["draft", "ready", "published"]

function statusLabel(status: PaperDocStatus) {
  return status === "ready"
    ? "Ready"
    : status === "published"
      ? "Published"
      : "Draft"
}

export function PaperWorkspace() {
  const paper = usePaperDocs()
  const [query, setQuery] = useState("")
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<PaperDoc | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<PaperDoc | null>(null)

  const openDoc = openDocId
    ? (paper.docs.find((doc) => doc.id === openDocId) ?? null)
    : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return paper.docs
    return paper.docs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        TYPE_LABEL[d.kind].toLowerCase().includes(q)
    )
  }, [paper.docs, query])

  const summary = paperSummary(paper.docs)

  async function handleCreate(kind: PaperContentKind) {
    const created = await paper.createDoc(kind)
    setOpenDocId(created.id)
  }

  function openRename(doc: PaperDoc) {
    setRenameTarget(doc)
    setRenameValue(doc.name)
  }

  function submitRename() {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name || name === renameTarget.name) {
      setRenameTarget(null)
      return
    }
    paper.renameDoc(renameTarget.id, name)
    setRenameTarget(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    if (openDocId === id) setOpenDocId(null)
    await paper.deleteDoc(id)
  }

  const errorBanner = paper.error ? (
    <div
      role="alert"
      className="border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive"
    >
      {paper.error}
    </div>
  ) : null

  const dialogs = (
    <>
      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>
              The name shows on the drive and in the editor header.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            aria-label="Document name"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename()
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete “${deleteTarget.name}”? This cannot be undone.`
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (openDoc) {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col">
          {errorBanner}
          <div className="min-h-0 flex-1">
            <PaperEditor
              doc={openDoc}
              docs={paper.docs}
              revertKey={paper.revertKey}
              onBack={() => setOpenDocId(null)}
              onSelectDoc={setOpenDocId}
              onChange={paper.updateContent}
              onRename={(name) => paper.renameDoc(openDoc.id, name)}
              onStatusChange={(status) => paper.setStatus(openDoc.id, status)}
              onDelete={() => setDeleteTarget(openDoc)}
            />
          </div>
        </div>
        {dialogs}
      </>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#FAFAFA]"
      role="region"
      aria-label="Paper"
    >
      {errorBanner}
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
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
            <Button type="button" size="sm" variant="outline" disabled>
              <Filter className="size-3.5" />
              Filter
              <span className="text-muted-foreground"> · Coming soon</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" size="sm" disabled={paper.creating} />
                }
                aria-label="New document"
              >
                <Plus className="size-3.5" />
                New
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onClick={() => void handleCreate("cv")}>
                  CV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleCreate("letter")}>
                  Letter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleCreate("proof")}>
                  Proof
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="overflow-x-auto">
            {paper.isLoading ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                Loading documents…
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                {query.trim()
                  ? "No documents match that search."
                  : "No documents yet. Create a CV, Letter, or Proof to start."}
              </p>
            ) : (
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
                        {TYPE_LABEL[doc.kind]}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatPaperUpdated(doc.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">—</td>
                      <td className="px-4 py-3">
                        <RowMenu
                          doc={doc}
                          onRename={() => openRename(doc)}
                          onStatus={(status) => paper.setStatus(doc.id, status)}
                          onDelete={() => setDeleteTarget(doc)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {dialogs}
    </div>
  )
}

function RowMenu({
  doc,
  onRename,
  onStatus,
  onDelete,
}: {
  doc: PaperDoc
  onRename: () => void
  onStatus: (status: PaperDocStatus) => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Document actions for ${doc.name}`}
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
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onRename()
          }}
        >
          Rename
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
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StatusBadge({ status }: { status: PaperDocStatus }) {
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
      {statusLabel(status)}
    </span>
  )
}
