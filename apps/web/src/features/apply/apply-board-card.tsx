import { CalendarDays, GripVertical, Star } from "lucide-react"

import {
  companyShort,
  formatTrackDate,
  trackKindLabel,
  type ApplyCard,
} from "@/features/apply/apply-types.ts"

export function BoardJobCardBody({ card }: { card: ApplyCard }) {
  return (
    <>
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
        <span className="flex size-5 items-center justify-center rounded bg-muted text-xs font-bold tracking-tight text-foreground">
          {companyShort(card.company)}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {card.company}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 pl-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CalendarDays className="size-3 shrink-0 opacity-70" />
          {formatTrackDate(card.trackDate)}
        </span>
        <span className="truncate">{trackKindLabel(card.trackKind)}</span>
      </div>
    </>
  )
}
