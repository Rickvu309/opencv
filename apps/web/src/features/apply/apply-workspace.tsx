/**
 * Apply: kanban + calendar for tracking Opportunities.
 * Do not import shell chrome — the route mounts this into `<Outlet />`.
 * Fit is stored on the server and never rendered (PRODUCT.md open q. 1).
 */
import { useMemo, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  Empty,
  EmptyDescription,
} from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import type { ApplyStage } from "@workspace/domain"
import {
  CalendarDays,
  Filter,
  GripVertical,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Star,
} from "lucide-react"

import { ComingSoon, comingSoonLabel } from "@/components/coming-soon.tsx"
import { ErrorBanner } from "@/components/error-banner.tsx"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import { ApplyCalendar } from "@/features/apply/apply-calendar.tsx"
import {
  allowCardDrop,
  readCardDragId,
  setCardDragData,
} from "@/features/apply/apply-dnd.ts"
import { JobDetailPanel } from "@/features/apply/apply-job-detail.tsx"
import {
  companyShort,
  formatTrackDate,
  STAGES,
  trackKindLabel,
  type ApplyCard,
  type StageId,
} from "@/features/apply/apply-types.ts"
import { useApplyCards } from "@/features/apply/use-apply-cards.ts"
import { DestructiveCommandDialog } from "@/features/commands/destructive-command-dialog.tsx"
import { usePaperDocs } from "@/features/paper/use-paper-docs.ts"

export function ApplyWorkspace() {
  const apply = useApplyCards()
  const paper = usePaperDocs()
  const [view, setView] = useState<"board" | "calendar">("board")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null)
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApplyCard | null>(null)
  const dragMovedRef = useRef(false)

  const selected = apply.cards.find((c) => c.id === selectedId)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return apply.cards
    return apply.cards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
    )
  }, [apply.cards, query])

  function move(id: string, stage: StageId, beforeCardId?: string | null) {
    const card = apply.cards.find((item) => item.id === id)
    if (!card) return
    if (beforeCardId === id) return

    const column = apply.cards.filter((item) => item.stage === stage)
    const currentIndex = column.findIndex((item) => item.id === id)
    const currentNext = currentIndex === -1 ? undefined : column[currentIndex + 1]
    if (
      card.stage === stage &&
      (currentNext?.id ?? null) === (beforeCardId ?? null)
    ) {
      return
    }

    apply.moveCard(id, stage, beforeCardId)
  }

  function moveDate(id: string, trackDate: string) {
    apply.updateCard({ cardId: id, trackDate })
  }

  function selectCard(id: string) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    setSelectedId((current) => (current === id ? null : id))
  }

  async function addJob() {
    const created = await apply.createCard()
    setSelectedId(created.id)
  }

  const errorBanner = apply.error ? (
    <ErrorBanner>{apply.error}</ErrorBanner>
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <WorkspaceHeader title="Apply">

        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs or companies"
            className="h-8 pl-8"
            aria-label="Search jobs"
          />
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled
        >
          <Filter className="size-3.5" />
          Filter
          <ComingSoon />
        </Button>

        <ButtonGroup
          aria-label="Apply view"
          className="rounded-lg border border-border p-0.5"
        >
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setView("board")}
            aria-pressed={view === "board"}
            className={
              view === "board"
                ? "bg-muted text-foreground"
                : "text-muted-foreground"
            }
          >
            <LayoutGrid className="size-3.5" />
            Board
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setView("calendar")}
            aria-pressed={view === "calendar"}
            className={
              view === "calendar"
                ? "bg-muted text-foreground"
                : "text-muted-foreground"
            }
          >
            <CalendarDays className="size-3.5" />
            Calendar
          </Button>
        </ButtonGroup>

        <Button
          type="button"
          size="sm"
          className="h-8"
          onClick={() => void addJob()}
          disabled={apply.creating}
        >
          <Plus className="size-3.5" />
          Add job
        </Button>
      </WorkspaceHeader>

      {errorBanner}

      <div className="flex min-h-0 flex-1">
        {apply.isLoading ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Loading Apply…
          </p>
        ) : view === "board" ? (
          <div className="min-w-0 flex-1 overflow-x-auto p-4">
            <div className="flex h-full min-h-[28rem] gap-3">
              {STAGES.map((stage) => {
                const col = filtered.filter((c) => c.stage === stage.id)
                const isDropTarget = dragOverStage === stage.id
                return (
                  <div
                    key={stage.id}
                    data-stage={stage.id}
                    className={cn(
                      "flex w-64 shrink-0 flex-col rounded-xl bg-background transition-colors",
                      isDropTarget && "ring-2 ring-ring/30"
                    )}
                    onDragOver={(e) => {
                      allowCardDrop(e)
                      setDragOverStage(stage.id)
                    }}
                    onDragLeave={() =>
                      setDragOverStage((s) => (s === stage.id ? null : s))
                    }
                    onDrop={(e) => {
                      e.preventDefault()
                      const id = readCardDragId(e)
                      if (id) move(id, stage.id, null)
                      setDragOverStage(null)
                      setDragOverCardId(null)
                    }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className={cn("size-2 rounded-full", stage.dot)} />
                      <span className="text-sm font-medium">{stage.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {col.length}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled
                        title="Coming soon"
                        className="ml-auto"
                        aria-label={comingSoonLabel(`${stage.label} column menu`)}
                      >
                        <MoreHorizontal className="size-4" />
                        <ComingSoon silent />
                      </Button>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 overflow-auto px-2 pb-3">
                      {col.map((card) => (
                        <BoardJobCard
                          key={card.id}
                          card={card}
                          active={card.id === selectedId}
                          insertBefore={dragOverCardId === card.id}
                          onSelect={() => selectCard(card.id)}
                          onDragStart={() => {
                            dragMovedRef.current = false
                          }}
                          onDrag={() => {
                            dragMovedRef.current = true
                          }}
                          onDragOver={() => setDragOverCardId(card.id)}
                          onDragLeave={() =>
                            setDragOverCardId((id) =>
                              id === card.id ? null : id
                            )
                          }
                          onDrop={(id) => move(id, stage.id, card.id)}
                        />
                      ))}
                      {col.length === 0 ? (
                        <Empty className="rounded-xl border border-dashed border-border px-3 py-8">
                          <EmptyDescription className="text-xs">
                            Drop a job here
                          </EmptyDescription>
                        </Empty>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <ApplyCalendar
            cards={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMoveDate={moveDate}
            dragMovedRef={dragMovedRef}
          />
        )}

        {selected ? (
          <JobDetailPanel
            card={selected}
            revertKey={apply.revertKey}
            paperDocs={paper.docs}
            onClose={() => setSelectedId(null)}
            onPatch={(patch) =>
              apply.updateCard({ cardId: selected.id, ...patch })
            }
            onMove={(stage: ApplyStage) => move(selected.id, stage, null)}
            onToggleStar={() => apply.toggleStar(selected.id)}
            onRemove={() => setDeleteTarget(selected)}
            onLinkPaper={(docId, applyCardId) =>
              paper.linkApplyCard(docId, applyCardId)
            }
          />
        ) : null}
      </div>

      {deleteTarget ? (
        <DestructiveCommandDialog
          open
          title="Delete job"
          name={`${deleteTarget.title} at ${deleteTarget.company}`}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onConfirm={() => {
            const id = deleteTarget.id
            setDeleteTarget(null)
            if (selectedId === id) setSelectedId(null)
            void apply.deleteCard(id)
          }}
        />
      ) : null}
    </div>
  )
}

function BoardJobCard({
  card,
  active,
  insertBefore,
  onSelect,
  onDragStart,
  onDrag,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  card: ApplyCard
  active: boolean
  insertBefore: boolean
  onSelect: () => void
  onDragStart: () => void
  onDrag: () => void
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (id: string) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-card-id={card.id}
      aria-label={`${card.title} at ${card.company}`}
      onDragStart={(e) => {
        onDragStart()
        setCardDragData(e, card.id)
      }}
      onDrag={onDrag}
      onDragEnd={onDrag}
      onDragOver={(e) => {
        allowCardDrop(e)
        e.stopPropagation()
        onDragOver()
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const id = readCardDragId(e)
        if (id) onDrop(id)
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "group cursor-grab rounded-xl border bg-card p-3 text-left shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-[border-color,box-shadow,opacity] duration-150 active:cursor-grabbing",
        active
          ? "border-foreground/20 ring-1 ring-ring/30"
          : "border-border hover:border-foreground/15 hover:shadow-[0_2px_8px_oklch(0_0_0/0.05)]",
        insertBefore && "ring-2 ring-ring/40"
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
          {card.title}
        </p>
        {card.starred ? (
          <Star className="size-3.5 shrink-0 fill-foreground/20 text-foreground/50" />
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2 pl-5">
        <span className="flex size-5 items-center justify-center rounded bg-muted text-3xs font-bold tracking-tight text-muted-foreground">
          {companyShort(card.company)}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {card.company}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 pl-5 text-micro text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CalendarDays className="size-3 shrink-0 opacity-70" />
          {formatTrackDate(card.trackDate)}
        </span>
        <span className="truncate">{trackKindLabel(card.trackKind)}</span>
      </div>
    </div>
  )
}
