/**
 * Apply: kanban + calendar for tracking Opportunities.
 * Do not import shell chrome — the route mounts this into `<Outlet />`.
 * Fit is stored on the server and never rendered (PRODUCT.md open q. 1).
 * Board columns are fluid (QVE-235) so Inbox → Closed glances on a
 * typical laptop without horizontal hunting. The board is Kibo kanban:
 * pointer, touch and keyboard moves all end in `move`.
 */
import { useMemo, useRef, useState } from "react"
import { isDemoApplyCard, type ApplyStage } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import type { FilterValue } from "@workspace/ui/components/filter-menu"
import { Input } from "@workspace/ui/components/input"
import { NotificationStack } from "@workspace/ui/components/notification-stack"
import { NumberTicker } from "@workspace/ui/components/number-ticker"
import { SegmentedControl } from "@workspace/ui/components/segmented-control"
import { CalendarDays, LayoutGrid, Plus, Search } from "lucide-react"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import {
  AddJobDialog,
  type AddJobDraft,
} from "@/features/apply/apply-add-job-dialog.tsx"
import { ApplyCalendar } from "@/features/apply/apply-calendar.tsx"
import { ApplyBoard } from "@/features/apply/apply-board.tsx"
import { ApplyDemoClearDialog } from "@/features/apply/apply-demo-clear-dialog.tsx"
import { ApplyFilterPopover } from "@/features/apply/apply-filter-popover.tsx"
import { filterApplyCards } from "@/features/apply/apply-filters.ts"
import { pickGuidedApplyCard } from "@/features/apply/apply-guide.ts"
import {
  APPLY_ADD_LABEL,
  APPLY_EMPTY_TEXT,
  APPLY_EMPTY_TITLE,
  APPLY_SEARCH_LABEL,
} from "@/features/apply/apply-job-structure.ts"
import { JobDetailPanel } from "@/features/apply/apply-job-detail.tsx"
import { applyNotices } from "@/features/apply/apply-notices.ts"
import {
  localIsoDate,
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
  const [filters, setFilters] = useState<FilterValue>({})
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
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

  const filtered = useMemo(
    () => filterApplyCards(apply.cards, query, filters),
    [apply.cards, query, filters]
  )
  const filtering =
    query.trim() !== "" || Object.values(filters).some((ids) => ids.length > 0)

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

  const emptyState = (
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
  )

  const notices = applyNotices(apply.cards, localIsoDate(), dismissed, {
    onClearDemo: () => setClearDemoOpen(true),
    onOpenCard: chooseCard,
  })
  const noticeStack =
    notices.length > 0 ? (
      <div className="absolute bottom-3 left-3 z-20 w-[min(18rem,calc(100%-1.5rem))]">
        <NotificationStack
          key={notices.map((notice) => notice.id).join()}
          notices={notices}
          onDismiss={(notice) =>
            setDismissed((prev) => new Set(prev).add(notice.id))
          }
        />
      </div>
    ) : null

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

        <p className="text-xs text-muted-foreground tabular-nums">
          <NumberTicker value={apply.cards.length} duration={280} />{" "}
          {apply.cards.length === 1 ? "Opportunity" : "Opportunities"}
        </p>

        <ApplyFilterPopover
          cards={apply.cards}
          value={filters}
          onChange={setFilters}
        />

        <SegmentedControl
          aria-label="Apply view"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: "Board", icon: <LayoutGrid /> },
            { value: "calendar", label: "Calendar", icon: <CalendarDays /> },
          ]}
        />

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

      <div className="relative flex min-h-0 flex-1">
        {apply.isLoading ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Loading Apply…
          </p>
        ) : view === "board" ? (
          <ApplyBoard
            cards={filtered}
            selectedId={selectedId}
            filtering={filtering}
            boardEmpty={boardEmpty}
            empty={emptyState}
            onSelect={selectCard}
            onMove={(id, placement) =>
              move(id, placement.stage, placement.beforeCardId)
            }
          />
        ) : (
          <ApplyCalendar
            cards={filtered}
            selectedId={selectedId}
            onSelect={chooseCard}
            onMoveDate={moveDate}
            dragMovedRef={dragMovedRef}
          />
        )}

        {noticeStack}

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
