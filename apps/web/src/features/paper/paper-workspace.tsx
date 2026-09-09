/**
 * Paper drive + document editor. Mounts through the Paper route seam.
 */
import { useEffect, useMemo, useState } from "react"
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
import {
  Empty,
  EmptyDescription,
} from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
  STARTER_CV_NAME,
  type PaperContentKind,
  type PaperDoc,
  type PaperDocStatus,
} from "@workspace/domain"
import { Filter, MoreHorizontal, Plus, Search } from "lucide-react"

import { ComingSoon } from "@/components/coming-soon.tsx"
import { ErrorBanner } from "@/components/error-banner.tsx"
import { useApplyCards } from "@/features/apply/use-apply-cards.ts"
import { DestructiveCommandDialog } from "@/features/commands/destructive-command-dialog.tsx"
import { authClient } from "@/lib/auth-client.ts"

import { paperAttachPair } from "./paper-apply-attach.ts"
import {
  SAMPLE_CV_LABEL,
  SAMPLE_CV_MAKE_MINE,
  TYPE_LABEL,
  cvContentOf,
  formatPaperUpdated,
  isSampleCv,
  ownedCvName,
  paperSummary,
  type PaperSummaryId,
} from "./paper-data.ts"
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

export function PaperWorkspace({
  openSample = false,
}: {
  openSample?: boolean
}) {
  const paper = usePaperDocs()
  const apply = useApplyCards()
  const { data: session } = authClient.useSession()
  const [query, setQuery] = useState("")
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [openedSample, setOpenedSample] = useState(false)
  const [renameTarget, setRenameTarget] = useState<PaperDoc | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<PaperDoc | null>(null)
  const [linkTarget, setLinkTarget] = useState<PaperDoc | null>(null)

  const openDoc = openDocId
    ? (paper.docs.find((doc) => doc.id === openDocId) ?? null)
    : null

  useEffect(() => {
    if (!openSample || openedSample || paper.isLoading) return
    const sample = paper.docs.find((doc) => doc.name === STARTER_CV_NAME)
    if (!sample) {
      setOpenedSample(true)
      return
    }
    setOpenDocId(sample.id)
    setOpenedSample(true)
  }, [openSample, openedSample, paper.docs, paper.isLoading])

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

  function handleSummaryCta(id: PaperSummaryId) {
    if (id === "letters") {
      void handleCreate("letter")
      return
    }
    if (id === "proof") {
      void handleCreate("proof")
      return
    }
    if (id === "linked") {
      const pair = paperAttachPair(paper.docs, apply.cards)
      if (pair) paper.linkApplyCard(pair.doc.id, pair.card.id)
    }
  }

  function makeMine(doc: PaperDoc) {
    if (!isSampleCv(doc)) return
    paper.renameDoc(
      doc.id,
      ownedCvName(session?.user.name, cvContentOf(doc).name)
    )
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
    <ErrorBanner>{paper.error}</ErrorBanner>
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

      {deleteTarget ? (
        <DestructiveCommandDialog
          open
          title={isSampleCv(deleteTarget) ? "Clear sample" : "Delete document"}
          name={deleteTarget.name}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      <Dialog
        open={Boolean(linkTarget)}
        onOpenChange={(open) => {
          if (!open) setLinkTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Apply</DialogTitle>
            <DialogDescription>
              Connect this document to an Opportunity card, or remove the link.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1">
            {apply.cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Apply cards yet.
              </p>
            ) : (
              apply.cards.map((card) => (
                <Button
                  key={card.id}
                  type="button"
                  variant={
                    linkTarget?.applyCardId === card.id ? "secondary" : "ghost"
                  }
                  className="justify-start"
                  onClick={() => {
                    if (!linkTarget) return
                    paper.linkApplyCard(linkTarget.id, card.id)
                    setLinkTarget(null)
                  }}
                >
                  {card.company} · {card.title}
                </Button>
              ))
            )}
          </div>
          <DialogFooter>
            {linkTarget?.applyCardId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  paper.linkApplyCard(linkTarget.id, null)
                  setLinkTarget(null)
                }}
              >
                Unlink
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkTarget(null)}
            >
              Cancel
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
      className="flex h-full min-h-0 flex-col bg-sidebar"
      role="region"
      aria-label="Paper"
    >
      {errorBanner}
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <div
              key={item.id}
              role="region"
              aria-label={item.label}
              className="rounded-lg border border-border bg-background p-4 shadow-sm"
            >
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                {item.value}
              </p>
              {item.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
              ) : null}
              {item.cta && !paper.isLoading ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="mt-2 h-6 px-1.5 text-xs font-medium text-muted-foreground"
                  onClick={() => handleSummaryCta(item.id)}
                >
                  {item.cta}
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="pl-8"
                aria-label="Search documents"
              />
            </div>
            <Button type="button" size="sm" variant="outline" disabled>
              <Filter className="size-3.5" />
              Filter
              <ComingSoon />
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
              <Empty className="py-8">
                <EmptyDescription>
                  {query.trim()
                    ? "No documents match that search."
                    : "No documents yet. Create a CV, Letter, or Proof to start."}
                </EmptyDescription>
              </Empty>
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
                          <span className="min-w-0">
                            <span className="block font-medium">{doc.name}</span>
                            {isSampleCv(doc) ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {SAMPLE_CV_LABEL}
                              </span>
                            ) : null}
                          </span>
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {apply.cards.find((card) => card.id === doc.applyCardId)
                          ?.company ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <RowMenu
                          doc={doc}
                          onMakeMine={() => makeMine(doc)}
                          onRename={() => openRename(doc)}
                          onStatus={(status) => paper.setStatus(doc.id, status)}
                          onLink={() => setLinkTarget(doc)}
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
  onMakeMine,
  onRename,
  onStatus,
  onLink,
  onDelete,
}: {
  doc: PaperDoc
  onMakeMine: () => void
  onRename: () => void
  onStatus: (status: PaperDocStatus) => void
  onLink: () => void
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
