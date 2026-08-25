import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { PaperDoc } from "@workspace/domain"
import {
  Check,
  ChevronDown,
  ExternalLink,
  Link2,
  Star,
  Trash2,
  X,
} from "lucide-react"

import {
  formatApplyUpdated,
  STAGES,
  trackKindLabel,
  type ApplyCard,
  type StageId,
  type TrackKind,
} from "@/features/apply/apply-types.ts"

type Props = {
  card: ApplyCard
  revertKey: number
  paperDocs: PaperDoc[]
  onClose: () => void
  onPatch: (
    patch: Partial<
      Pick<ApplyCard, "title" | "company" | "note" | "trackDate" | "trackKind">
    >
  ) => void
  onMove: (stage: StageId) => void
  onToggleStar: () => void
  onRemove: () => void
  onLinkPaper: (docId: string, applyCardId: string | null) => void
}

const TRACK_KINDS: TrackKind[] = [
  "interview",
  "deadline",
  "followup",
  "applied",
]

export function JobDetailPanel({
  card,
  revertKey,
  paperDocs,
  onClose,
  onPatch,
  onMove,
  onToggleStar,
  onRemove,
  onLinkPaper,
}: Props) {
  const stageLabel = STAGES.find((s) => s.id === card.stage)?.label ?? "Inbox"
  const [linkOpen, setLinkOpen] = useState(false)

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
            onClick={() => window.open(card.jobUrl ?? undefined, "_blank")}
          >
            <ExternalLink className="size-3.5" />
          </ToolbarIconButton>
        ) : null}
        <PaperLinkMenu
          open={linkOpen}
          onOpenChange={setLinkOpen}
          cardId={card.id}
          docs={paperDocs}
          onLink={onLinkPaper}
        />
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
        <JobDetailFields
          key={`${card.id}:${revertKey}`}
          card={card}
          onPatch={onPatch}
        />

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

        <JobDetailNote
          key={`${card.id}:note:${revertKey}`}
          note={card.note}
          onCommit={(next) => onPatch({ note: next })}
        />

        <p className="text-[11px] text-muted-foreground">
          {formatApplyUpdated(card.updatedAt)}
        </p>
      </div>
    </aside>
  )
}

function JobDetailFields({
  card,
  onPatch,
}: {
  card: ApplyCard
  onPatch: Props["onPatch"]
}) {
  const [title, setTitle] = useState(card.title)
  const [company, setCompany] = useState(card.company)

  function commitTitle() {
    const next = title.trim()
    if (!next || next === card.title) {
      setTitle(card.title)
      return
    }
    onPatch({ title: next })
  }

  function commitCompany() {
    const next = company.trim()
    if (!next || next === card.company) {
      setCompany(card.company)
      return
    }
    onPatch({ company: next })
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Job title
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-ring/40"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Company
        </span>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onBlur={commitCompany}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring/40"
        />
      </label>
    </div>
  )
}

function JobDetailNote({
  note,
  onCommit,
}: {
  note: string
  onCommit: (note: string) => void
}) {
  const [value, setValue] = useState(note)

  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Notes
      </span>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== note) onCommit(value)
        }}
        rows={5}
        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring/40"
        placeholder="What to prep, who you talked to, next step…"
      />
    </label>
  )
}

function PaperLinkMenu({
  open,
  onOpenChange,
  cardId,
  docs,
  onLink,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cardId: string
  docs: PaperDoc[]
  onLink: (docId: string, applyCardId: string | null) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open, onOpenChange])

  return (
    <div ref={rootRef} className="relative">
      <ToolbarIconButton
        label="Link Paper docs"
        onClick={() => onOpenChange(!open)}
        active={open || docs.some((doc) => doc.applyCardId === cardId)}
      >
        <Link2 className="size-3.5" />
      </ToolbarIconButton>
      {open ? (
        <div
          role="menu"
          aria-label="Link Paper docs"
          className="absolute top-full left-0 z-20 mt-1 max-h-64 w-64 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {docs.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No Paper docs yet.
            </p>
          ) : (
            docs.map((doc) => {
              const linkedHere = doc.applyCardId === cardId
              return (
                <button
                  key={doc.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={linkedHere}
                  onClick={() =>
                    onLink(doc.id, linkedHere ? null : cardId)
                  }
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                >
                  <Check
                    className={cn(
                      "size-3 shrink-0",
                      linkedHere ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
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
  disabled,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  active?: boolean
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Coming soon" : undefined}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {children}
    </button>
  )
}
