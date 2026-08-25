/**
 * Apply: kanban + calendar for tracking Opportunities.
 * Do not import shell chrome — the route mounts this into `<Outlet />`.
 * Fit stays on the card shape but is not shown (PRODUCT.md open q. 1).
 */
import { useMemo, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
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

import { ApplyCalendar } from "@/features/apply/apply-calendar.tsx"
import {
  allowCardDrop,
  readCardDragId,
  setCardDragData,
} from "@/features/apply/apply-dnd.ts"
import { JobDetailPanel } from "@/features/apply/apply-job-detail.tsx"
import {
  formatTrackDate,
  SEED_CARDS,
  STAGES,
  trackKindLabel,
  type ApplyCard,
  type StageId,
} from "@/features/apply/apply-types.ts"

export function ApplyWorkspace() {
  const [view, setView] = useState<"board" | "calendar">("board")
  const [cards, setCards] = useState(SEED_CARDS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null)
  const dragMovedRef = useRef(false)

  const selected = cards.find((c) => c.id === selectedId)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cards
    return cards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
    )
  }, [cards, query])

  function patchCard(id: string, patch: Partial<ApplyCard>) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...patch, updated: "Updated just now" } : c
      )
    )
  }

  function move(id: string, stage: StageId) {
    patchCard(id, { stage })
  }

  function moveDate(id: string, trackDate: string) {
    patchCard(id, { trackDate })
  }

  function toggleStar(id: string) {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    patchCard(id, { starred: !card.starred })
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    setSelectedId((current) => (current === id ? null : current))
  }

  function selectCard(id: string) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    setSelectedId((current) => (current === id ? null : id))
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAFA]">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2.5 sm:px-5">
        <h1 className="text-sm font-semibold tracking-tight">Apply</h1>

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
          <span className="text-muted-foreground"> · Coming soon</span>
        </Button>

        <div className="flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView("board")}
            aria-pressed={view === "board"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === "board"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-3.5" />
            Board
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            aria-pressed={view === "calendar"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === "calendar"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="size-3.5" />
            Calendar
          </button>
        </div>

        <Button type="button" size="sm" className="h-8" disabled>
          <Plus className="size-3.5" />
          Add job
          <span className="text-muted-foreground"> · Coming soon</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {view === "board" ? (
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
                      if (id) move(id, stage.id)
                      setDragOverStage(null)
                    }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className={cn("size-2 rounded-full", stage.dot)} />
                      <span className="text-sm font-medium">{stage.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {col.length}
                      </span>
                      <button
                        type="button"
                        disabled
                        title="Coming soon"
                        className="ml-auto text-muted-foreground disabled:opacity-50"
                        aria-label={`${stage.label} column menu — coming soon`}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 overflow-auto px-2 pb-3">
                      {col.map((card) => (
                        <BoardJobCard
                          key={card.id}
                          card={card}
                          active={card.id === selectedId}
                          onSelect={() => selectCard(card.id)}
                          onDragStart={() => {
                            dragMovedRef.current = false
                          }}
                          onDrag={() => {
                            dragMovedRef.current = true
                          }}
                        />
                      ))}
                      {col.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                          Drop a job here
                        </div>
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
            onClose={() => setSelectedId(null)}
            onPatch={(patch) => patchCard(selected.id, patch)}
            onMove={(stage) => move(selected.id, stage)}
            onToggleStar={() => toggleStar(selected.id)}
            onRemove={() => removeCard(selected.id)}
          />
        ) : null}
      </div>
    </div>
  )
}

function BoardJobCard({
  card,
  active,
  onSelect,
  onDragStart,
  onDrag,
}: {
  card: ApplyCard
  active: boolean
  onSelect: () => void
  onDragStart: () => void
  onDrag: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      aria-label={`${card.title} at ${card.company}`}
      onDragStart={(e) => {
        onDragStart()
        setCardDragData(e, card.id)
      }}
      onDrag={onDrag}
      onDragEnd={onDrag}
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
          : "border-border hover:border-foreground/15 hover:shadow-[0_2px_8px_oklch(0_0_0/0.05)]"
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
        <span className="flex size-5 items-center justify-center rounded bg-muted text-[9px] font-bold tracking-tight text-muted-foreground">
          {card.companyShort}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {card.company}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 pl-5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CalendarDays className="size-3 shrink-0 opacity-70" />
          {formatTrackDate(card.trackDate)}
        </span>
        <span className="truncate">{trackKindLabel(card.trackKind)}</span>
      </div>
    </div>
  )
}
