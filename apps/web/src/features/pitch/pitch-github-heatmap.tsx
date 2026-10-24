/**
 * GitHub contribution graph — renders mock contribution data only.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

import type { GithubContribution } from "@/features/pitch/pitch-github-mock.ts"

/** Documented exception: GitHub heatmap ramp — tokenized as its own variables. */
const LEVEL_CLASS = [
  "bg-github-heatmap-0",
  "bg-github-heatmap-1",
  "bg-github-heatmap-2",
  "bg-github-heatmap-3",
  "bg-github-heatmap-4",
] as const

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""] as const

const WEEKDAY_COL_WIDTH = 28
const GAP = 2
const MIN_CELL = 7
const MAX_CELL = 11

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function toIsoLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return { y: y!, m: m! - 1, d: d! }
}

type Week = { days: (GithubContribution | null)[] }

function buildWeeks(contributions: GithubContribution[]): Week[] {
  if (contributions.length === 0) return []

  const byDate = new Map(contributions.map((c) => [c.date, c]))
  const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date))
  const first = parseDate(sorted[0]!.date)
  const last = parseDate(sorted[sorted.length - 1]!.date)

  const start = new Date(first.y, first.m, first.d)
  start.setDate(start.getDate() - start.getDay())

  const end = new Date(last.y, last.m, last.d)
  end.setDate(end.getDate() + (6 - end.getDay()))

  const weeks: Week[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const days: (GithubContribution | null)[] = []
    for (let i = 0; i < 7; i++) {
      const iso = toIsoLocal(cursor)
      days.push(byDate.get(iso) ?? null)
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push({ days })
  }

  return weeks
}

function monthLabels(weeks: Week[]) {
  const labels: { label: string; index: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, index) => {
    const firstDay = week.days.find(Boolean)
    if (!firstDay) return
    const { m } = parseDate(firstDay.date)
    if (m !== lastMonth) {
      labels.push({ label: MONTHS[m]!, index })
      lastMonth = m
    }
  })
  return labels
}

function cellSizeForWidth(width: number, weekCount: number) {
  if (width <= 0 || weekCount === 0) {
    return { cellPx: MAX_CELL, scroll: false }
  }

  const graphMinWidth = weekCount * MIN_CELL + (weekCount - 1) * GAP
  const totalMin = graphMinWidth + WEEKDAY_COL_WIDTH
  if (totalMin > width) {
    return { cellPx: MIN_CELL, scroll: true }
  }

  const available = width - WEEKDAY_COL_WIDTH - (weekCount - 1) * GAP
  const raw = Math.floor(available / weekCount)
  return {
    cellPx: Math.min(MAX_CELL, Math.max(MIN_CELL, raw)),
    scroll: false,
  }
}

type Props = {
  contributions: GithubContribution[]
  className?: string
}

export function PitchGithubHeatmap({ contributions, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ cellPx: MAX_CELL, scroll: false })

  const weeks = useMemo(() => buildWeeks(contributions), [contributions])
  const months = useMemo(() => monthLabels(weeks), [weeks])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || weeks.length === 0) return

    const update = () => {
      setLayout(cellSizeForWidth(el.clientWidth, weeks.length))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [weeks.length])

  const { cellPx, scroll } = layout
  const rowHeight = cellPx * 7 + GAP * 6

  const graph = (
    <>
      <div
        className="mb-1 flex"
        style={{ gap: GAP, paddingLeft: WEEKDAY_COL_WIDTH }}
      >
        {weeks.map((_, weekIndex) => {
          const month = months.find((m) => m.index === weekIndex)
          return (
            <div
              key={weekIndex}
              className="shrink-0 overflow-hidden text-xs leading-none text-muted-foreground"
              style={{ width: cellPx, height: 10 }}
            >
              {month ? month.label : ""}
            </div>
          )
        })}
      </div>

      <div className="flex" style={{ gap: 4 }}>
        <div
          className="flex shrink-0 flex-col justify-between py-0.5 text-xs leading-none text-muted-foreground"
          style={{ width: WEEKDAY_COL_WIDTH, height: rowHeight }}
        >
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i} style={{ height: cellPx }}>
              {label}
            </span>
          ))}
        </div>

        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="flex shrink-0 flex-col"
              style={{ gap: GAP }}
            >
              {week.days.map((day, dayIndex) => {
                if (!day) {
                  return (
                    <div
                      key={dayIndex}
                      className="rounded-[2px] bg-transparent"
                      style={{ width: cellPx, height: cellPx }}
                    />
                  )
                }
                const level = Math.min(4, Math.max(0, day.level)) as
                  0 | 1 | 2 | 3 | 4
                return (
                  <div
                    key={dayIndex}
                    title={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date}`}
                    className={cn(
                      "rounded-[2px] outline outline-1 -outline-offset-1 outline-black/[0.04]",
                      LEVEL_CLASS[level]
                    )}
                    style={{ width: cellPx, height: cellPx }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )

  if (weeks.length === 0) {
    return (
      <div
        className={cn(
          "flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground",
          className
        )}
      >
        No contribution data
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn("w-full min-w-0", className)}>
      {scroll ? (
        <div className="overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="w-max">{graph}</div>
        </div>
      ) : (
        graph
      )}
    </div>
  )
}

export function PitchGithubHeatmapSkeleton({ compact }: { compact?: boolean }) {
  const cell = compact ? "size-[10px]" : "size-[11px]"
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-2 w-24 rounded bg-muted" />
      <div className="flex gap-[3px]">
        {Array.from({ length: compact ? 26 : 52 }).map((_, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, d) => (
              <div key={d} className={cn("rounded-[2px] bg-muted", cell)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
