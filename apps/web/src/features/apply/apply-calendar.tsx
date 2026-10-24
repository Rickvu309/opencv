/**
 * Apply calendar — month/week view for Opportunity Tracks.
 */
import { useMemo, useState, type MutableRefObject } from "react"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

import {
  allowCardDrop,
  readCardDragId,
  setCardDragData,
} from "@/features/apply/apply-dnd.ts"
import {
  localIsoDate,
  trackKindLabel,
  type ApplyCard,
  type TrackKind,
} from "@/features/apply/apply-types.ts"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1)
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString("en-US", {
    month: "long",
  })
}

type Props = {
  cards: ApplyCard[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMoveDate: (id: string, date: string) => void
  dragMovedRef: MutableRefObject<boolean>
}

export function ApplyCalendar({
  cards,
  selectedId,
  onSelect,
  onMoveDate,
  dragMovedRef,
}: Props) {
  const today = new Date()
  const todayIso = localIsoDate(today)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [view, setView] = useState<"month" | "week">("month")
  const [focusDate, setFocusDate] = useState(todayIso)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  const cardsByDate = useMemo(() => {
    const map = new Map<string, ApplyCard[]>()
    for (const card of cards) {
      const list = map.get(card.trackDate) ?? []
      list.push(card)
      map.set(card.trackDate, list)
    }
    return map
  }, [cards])

  const monthCount = useMemo(() => {
    const set = new Set<string>()
    for (const card of cards) {
      const [y, m] = card.trackDate.split("-")
      if (Number(y) === year && Number(m) === month + 1) set.add(card.id)
    }
    return set.size
  }, [cards, year, month])

  function prevMonth() {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  const monthCells = useMemo(() => {
    const first = startOfMonth(year, month)
    const startPad = first.getDay()
    const dim = daysInMonth(year, month)
    const cells: { date: string; day: number; inMonth: boolean }[] = []

    const prevDim = daysInMonth(
      month === 0 ? year - 1 : year,
      month === 0 ? 11 : month - 1
    )
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevDim - i
      const m = month === 0 ? 11 : month - 1
      const y = month === 0 ? year - 1 : year
      cells.push({ date: toIso(y, m, d), day: d, inMonth: false })
    }
    for (let d = 1; d <= dim; d++) {
      cells.push({ date: toIso(year, month, d), day: d, inMonth: true })
    }
    while (cells.length % 7 !== 0) {
      const d = cells.length - startPad - dim + 1
      const m = month === 11 ? 0 : month + 1
      const y = month === 11 ? year + 1 : year
      cells.push({ date: toIso(y, m, d), day: d, inMonth: false })
    }
    return cells
  }, [year, month])

  const weekCells = useMemo(() => {
    const sel = new Date(`${focusDate}T12:00:00`)
    const start = new Date(sel)
    start.setDate(sel.getDate() - sel.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return {
        date: toIso(d.getFullYear(), d.getMonth(), d.getDate()),
        day: d.getDate(),
        inMonth: d.getMonth() === month,
      }
    })
  }, [focusDate, month])

  const cells = view === "month" ? monthCells : weekCells

  function selectCard(id: string) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    onSelect(selectedId === id ? null : id)
  }

  return (
    <div className="min-w-0 flex-1 overflow-auto p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-sm font-semibold tracking-tight">
            {monthLabel(year, month)} {year}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {monthCount} {monthCount === 1 ? "opportunity" : "opportunities"}{" "}
            with a track date
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <ButtonGroup
            aria-label="Calendar range"
            className="rounded-lg border border-border p-0.5"
          >
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setView("week")}
              aria-pressed={view === "week"}
              className={
                view === "week"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              }
            >
              Week
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setView("month")}
              aria-pressed={view === "month"}
              className={
                view === "month"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              }
            >
              Month
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="border-r border-border px-2 py-2 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        <div
          className={cn(
            "grid grid-cols-7",
            view === "week" ? "auto-rows-[minmax(8rem,1fr)]" : "auto-rows-fr"
          )}
        >
          {cells.map((cell) => {
            const dayCards = cardsByDate.get(cell.date) ?? []
            const isFocused = cell.date === focusDate
            const isToday = cell.date === todayIso
            const isDropTarget = dragOverDate === cell.date
            const visible = dayCards.slice(0, view === "week" ? 8 : 3)
            const overflow = dayCards.length - visible.length

            return (
              <div
                key={cell.date}
                data-track-date={cell.date}
                data-today={isToday ? "true" : undefined}
                className={cn(
                  "flex min-h-24 flex-col border-r border-b border-border p-1.5 transition-colors last:border-r-0",
                  !cell.inMonth && "bg-muted/20 text-muted-foreground",
                  cell.inMonth && "bg-background",
                  isFocused && "bg-muted/40",
                  isToday && "ring-1 ring-foreground/10 ring-inset",
                  isDropTarget && "bg-muted/60 ring-2 ring-ring/30 ring-inset"
                )}
                onDragOver={(e) => {
                  allowCardDrop(e)
                  setDragOverDate(cell.date)
                }}
                onDragLeave={() =>
                  setDragOverDate((d) => (d === cell.date ? null : d))
                }
                onDrop={(e) => {
                  e.preventDefault()
                  const id = readCardDragId(e)
                  if (id) onMoveDate(id, cell.date)
                  setDragOverDate(null)
                }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => setFocusDate(cell.date)}
                  className={cn(
                    "mb-1 h-auto w-full justify-start rounded px-1 py-0 text-left text-xs tabular-nums hover:bg-transparent hover:text-foreground",
                    isToday
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {cell.day}
                </Button>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {visible.map((card) => (
                    <CalendarJobChip
                      key={card.id}
                      card={card}
                      active={card.id === selectedId}
                      expanded={view === "week"}
                      onSelect={() => selectCard(card.id)}
                      onDragStart={() => {
                        dragMovedRef.current = false
                      }}
                      onDrag={() => {
                        dragMovedRef.current = true
                      }}
                    />
                  ))}
                  {overflow > 0 ? (
                    <span className="px-1 text-xs text-muted-foreground">
                      +{overflow} more
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CalendarJobChip({
  card,
  active,
  expanded,
  onSelect,
  onDragStart,
  onDrag,
}: {
  card: ApplyCard
  active: boolean
  expanded: boolean
  onSelect: () => void
  onDragStart: () => void
  onDrag: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        onDragStart()
        setCardDragData(e, card.id)
      }}
      onDrag={(e) => {
        e.stopPropagation()
        onDrag()
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        onDrag()
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={cn(
        "h-auto w-full cursor-grab justify-start rounded-md px-1.5 py-1 text-left text-xs leading-tight hover:bg-transparent active:cursor-grabbing",
        kindChipClass(card.trackKind),
        active && "ring-1 ring-ring/40"
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{card.title}</span>
        {expanded ? (
          <span className="mt-0.5 block truncate text-xs opacity-80">
            {card.company} · {trackKindLabel(card.trackKind)}
          </span>
        ) : null}
      </span>
    </Button>
  )
}

function kindChipClass(kind: TrackKind) {
  switch (kind) {
    case "interview":
      return "bg-foreground text-background"
    case "deadline":
      return "bg-secondary text-secondary-foreground"
    case "followup":
      return "bg-muted text-foreground"
    default:
      return "bg-card text-foreground ring-1 ring-border"
  }
}
