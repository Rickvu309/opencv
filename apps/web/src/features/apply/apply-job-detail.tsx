import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {
  ChevronDown,
  ExternalLink,
  Link2,
  Star,
  Trash2,
  X,
} from "lucide-react"

import {
  STAGES,
  trackKindLabel,
  type ApplyCard,
  type StageId,
  type TrackKind,
} from "@/features/apply/apply-types.ts"

type Props = {
  card: ApplyCard
  onClose: () => void
  onPatch: (patch: Partial<ApplyCard>) => void
  onMove: (stage: StageId) => void
  onToggleStar: () => void
  onRemove: () => void
}

const TRACK_KINDS: TrackKind[] = [
  "interview",
  "deadline",
  "followup",
  "applied",
]

export function JobDetailPanel({
  card,
  onClose,
  onPatch,
  onMove,
  onToggleStar,
  onRemove,
}: Props) {
  const stageLabel =
    STAGES.find((s) => s.id === card.stage)?.label ?? "Inbox"

  return (
    <aside
      aria-label="Job detail"
      className="flex w-80 shrink-0 flex-col border-l border-border bg-background shadow-[-4px_0_24px_oklch(0_0_0/0.04)]"
    >
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-2">
        <ToolbarIconButton
          label={card.starred ? "Unstar job" : "Star job"}
          onClick={onToggleStar}
          active={card.starred}
        >
          <Star
            className={cn(
              "size-3.5",
              card.starred && "fill-foreground/20 text-foreground"
            )}
          />
        </ToolbarIconButton>

        <StageMenu value={card.stage} label={stageLabel} onChange={onMove} />

        <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />

        {card.jobUrl ? (
          <ToolbarIconButton
            label="Open job posting"
            onClick={() => window.open(card.jobUrl, "_blank")}
          >
            <ExternalLink className="size-3.5" />
          </ToolbarIconButton>
        ) : null}
        <ToolbarIconButton label="Link Paper docs" onClick={() => undefined}>
          <Link2 className="size-3.5" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Delete job"
          onClick={onRemove}
          className="hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </ToolbarIconButton>

        <ToolbarIconButton
          label="Close panel"
          onClick={onClose}
          className="ml-auto"
        >
          <X className="size-3.5" />
        </ToolbarIconButton>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Job title
            </span>
            <input
              value={card.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-ring/40"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Company
            </span>
            <input
              value={card.company}
              onChange={(e) => onPatch({ company: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring/40"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Track date
            </span>
            <input
              type="date"
              value={card.trackDate}
              onChange={(e) => onPatch({ trackDate: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring/40"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Event type
            </span>
            <select
              value={card.trackKind}
              onChange={(e) =>
                onPatch({ trackKind: e.target.value as TrackKind })
              }
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring/40"
            >
              {TRACK_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {trackKindLabel(kind)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Notes
          </span>
          <textarea
            value={card.note}
            onChange={(e) => onPatch({ note: e.target.value })}
            rows={5}
            className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring/40"
            placeholder="What to prep, who you talked to, next step…"
          />
        </label>

        <p className="text-[11px] text-muted-foreground">{card.updated}</p>
      </div>
    </aside>
  )
}

function StageMenu({
  value,
  label,
  onChange,
}: {
  value: StageId
  label: string
  onChange: (stage: StageId) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Stage: ${label}`}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {label}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full left-0 z-20 mt-1 min-w-[8.5rem] rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(stage.id)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                value === stage.id && "bg-muted font-medium"
              )}
            >
              <span className={cn("size-1.5 rounded-full", stage.dot)} />
              {stage.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ToolbarIconButton({
  label,
  onClick,
  children,
  active,
  className,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}
