import { cn } from "@workspace/ui/lib/utils"
import { CalendarDays, GripVertical, Star } from "lucide-react"

import {
  allowCardDrop,
  readCardDragId,
  setCardDragData,
} from "@/features/apply/apply-dnd.ts"
import {
  companyShort,
  formatTrackDate,
  trackKindLabel,
  type ApplyCard,
} from "@/features/apply/apply-types.ts"

export function BoardJobCard({
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
        <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-semibold">
          {card.title}
        </p>
        {card.starred ? (
          <Star className="size-3.5 shrink-0 fill-foreground/20 text-foreground/50" />
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2 pl-5">
        <span className="flex size-5 items-center justify-center rounded bg-muted text-3xs font-bold tracking-tight text-foreground">
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
