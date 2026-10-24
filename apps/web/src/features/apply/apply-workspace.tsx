/**
 * Apply: kanban + calendar for tracking Opportunities.
 * Do not import shell chrome — the route mounts this into `<Outlet />`.
 * Fit is stored on the server and never rendered (PRODUCT.md open q. 1).
 * Board columns are fluid (QVE-235) so Inbox → Closed glances on a
 * typical laptop without horizontal hunting. Filter / column-menu
 * Coming-soon chrome is deferred until those actions exist.
 */
import { useMemo, useRef, useState } from "react"
import { isDemoApplyCard, type ApplyStage } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { CalendarDays, LayoutGrid, Plus, Search } from "lucide-react"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import {
  AddJobDialog,
  type AddJobDraft,
} from "@/features/apply/apply-add-job-dialog.tsx"
import { ApplyCalendar } from "@/features/apply/apply-calendar.tsx"
import { BoardJobCard } from "@/features/apply/apply-board-card.tsx"
import { ApplyDemoBanner } from "@/features/apply/apply-demo-banner.tsx"
import { ApplyDemoClearDialog } from "@/features/apply/apply-demo-clear-dialog.tsx"
import { allowCardDrop, readCardDragId } from "@/features/apply/apply-dnd.ts"
import { pickGuidedApplyCard } from "@/features/apply/apply-guide.ts"
import {
  APPLY_ADD_LABEL,
  APPLY_EMPTY_TEXT,
  APPLY_EMPTY_TITLE,
  APPLY_SEARCH_LABEL,
} from "@/features/apply/apply-job-structure.ts"
import { JobDetailPanel } from "@/features/apply/apply-job-detail.tsx"
import {
  STAGES,
  type ApplyCard,
  type StageId,
} from "@/features/apply/apply-types.ts"
import { useApplyCards } from "@/features/apply/use-apply-cards.ts"
import { DestructiveCommandDialog } from "@/features/commands/destructive-command-dialog.tsx"
import { recordFirstCafeItem } from "@/features/home/first-cafe-checklist.ts"
import { usePaperDocs } from "@/features/paper/use-paper-docs.ts"
import { authClient } from "@/lib/auth-client.ts"

export function ApplyWorkspace({ openGuide = false }: { openGuide?: boolean }) {
  const { data: session } = authClient.useSession()
  const apply = useApplyCards()
  const paper = usePaperDocs()
  const [view, setView] = useState<"board" | "calendar">("board")
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [selectionTouched, setSelectionTouched] = useState(false)
  const [query, setQuery] = useState("")
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null)
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApplyCard | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [clearDemoOpen, setClearDemoOpen] = useState(false)
  const dragMovedRef = useRef(false)

  const guidedCard = apply.isLoading ? null : pickGuidedApplyCard(apply.cards)
  const selectedId = selectionTouched
    ? pickedId
    : openGuide
      ? (guidedCard?.id ?? null)
      : null
  const selected = apply.cards.find((c) => c.id === selectedId)
  const guided = Boolean(
    openGuide && selectedId && guidedCard && selectedId === guidedCard.id
  )

  function chooseCard(id: string | null) {
    setSelectionTouched(true)
    setPickedId(id)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return apply.cards
    return apply.cards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)
    )
  }, [apply.cards, query])

  function move(id: string, stage: StageId, beforeCardId?: string | null) {
    const card = apply.cards.find((item) => item.id === id)
    if (!card) return
    if (beforeCardId === id) return

    const column = apply.cards.filter((item) => item.stage === stage)
    const currentIndex = column.findIndex((item) => item.id === id)
    const currentNext =
      currentIndex === -1 ? undefined : column[currentIndex + 1]
    if (
      card.stage === stage &&
      (currentNext?.id ?? null) === (beforeCardId ?? null)
    ) {
      return
    }

    apply.moveCard(id, stage, beforeCardId)
    const userId = session?.user.id
    if (userId) recordFirstCafeItem(userId, "apply")
  }

  function moveDate(id: string, trackDate: string) {
    apply.updateCard({ cardId: id, trackDate })
  }

  function selectCard(id: string) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    chooseCard(selectedId === id ? null : id)
  }

  async function addJob(draft: AddJobDraft) {
    const created = await apply.createCard({
      ...(draft.jobUrl ? { jobUrl: draft.jobUrl } : {}),
      ...(draft.title ? { title: draft.title } : {}),
      ...(draft.company ? { company: draft.company } : {}),
      ...(draft.note ? { note: draft.note } : {}),
    })
    setAddOpen(false)
    chooseCard(created.id)
  }

  const boardEmpty = apply.cards.length === 0

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
            placeholder={`${APPLY_SEARCH_LABEL} or companies`}
            className="h-8 pl-8"
            aria-label={APPLY_SEARCH_LABEL}
          />
        </div>

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
          className="h-12 px-4"
          onClick={() => setAddOpen(true)}
          disabled={apply.creating}
        >
          <Plus className="size-3.5" />
          {APPLY_ADD_LABEL}
        </Button>
      </WorkspaceHeader>

      {errorBanner}

      {apply.cards.some(isDemoApplyCard) ? (
        <ApplyDemoBanner
          clearing={apply.clearing}
          onClear={() => setClearDemoOpen(true)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {apply.isLoading ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Loading Apply…
          </p>
        ) : view === "board" ? (
          <div className="relative min-w-0 flex-1 overflow-hidden p-3">
            {boardEmpty ? (
              <Empty className="absolute top-1/2 left-1/2 z-10 w-80 flex-none -translate-x-1/2 -translate-y-1/2 border border-border bg-background">
                <EmptyHeader>
                  <EmptyTitle>{APPLY_EMPTY_TITLE}</EmptyTitle>
                  <EmptyDescription>{APPLY_EMPTY_TEXT}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    type="button"
                    className="h-12 px-4"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    {APPLY_ADD_LABEL}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : null}
            <div
              data-apply-board
              className="grid h-full min-h-[28rem] grid-cols-5 gap-2"
            >
              {STAGES.map((stage) => {
                const col = filtered.filter((c) => c.stage === stage.id)
                const isDropTarget = dragOverStage === stage.id
                return (
                  <div
                    key={stage.id}
                    data-stage={stage.id}
                    className={cn(
                      "flex min-w-0 flex-col rounded-xl bg-background transition-colors",
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
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          stage.dot
                        )}
                      />
                      <span className="min-w-0 truncate text-sm font-medium">
                        {stage.label}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {col.length}
                      </span>
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
                      {col.length === 0 && !boardEmpty ? (
                        <p className="px-1 text-xs text-muted-foreground">
                          {query.trim()
                            ? `No match in ${stage.label}`
                            : `Nothing in ${stage.label}`}
                        </p>
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
            onSelect={chooseCard}
            onMoveDate={moveDate}
            dragMovedRef={dragMovedRef}
          />
        )}

        {selected ? (
          <JobDetailPanel
            card={selected}
            guided={guided}
            revertKey={apply.revertKey}
            paperDocs={paper.docs}
            onClose={() => chooseCard(null)}
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

      <AddJobDialog
        open={addOpen}
        creating={apply.creating}
        onOpenChange={setAddOpen}
        onAdd={addJob}
      />

      {clearDemoOpen ? (
        <ApplyDemoClearDialog
          count={apply.cards.filter(isDemoApplyCard).length}
          onOpenChange={setClearDemoOpen}
          onConfirm={() => void apply.clearDemo()}
        />
      ) : null}

      {deleteTarget ? (
        <DestructiveCommandDialog
          open
          title="Delete opportunity"
          name={`${deleteTarget.title} at ${deleteTarget.company}`}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onConfirm={() => {
            const id = deleteTarget.id
            setDeleteTarget(null)
            if (selectedId === id) chooseCard(null)
            void apply.deleteCard(id)
          }}
        />
      ) : null}
    </div>
  )
}
