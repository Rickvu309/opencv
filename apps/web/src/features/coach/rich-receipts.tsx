import { useReducer, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { FileText } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  PAPER_KIND_LABEL,
  collapsedHunks,
  countChangedLines,
  type CoachReceiptDetail,
} from "@workspace/domain"

import {
  RECEIPT_STAGES as STAGES,
  stageLabel,
} from "@/features/coach/coach-receipt.ts"

type UpdateContentDetail = Extract<
  CoachReceiptDetail,
  { type: "paper.replace" }
>

export function DiffInsert({ children }: { children: ReactNode }) {
  return (
    <ins className="bg-chart-2/10 text-[color:color-mix(in_oklab,var(--chart-2)_65%,var(--foreground))] no-underline">
      {children}
    </ins>
  )
}

export function DiffDelete({ children }: { children: ReactNode }) {
  return (
    <del className="bg-destructive/10 text-[color:color-mix(in_oklab,var(--destructive)_80%,var(--foreground))] line-through">
      {children}
    </del>
  )
}

const DIFF_LINE_LABEL = { add: "After", del: "Before", eq: "" } as const

export function DiffBlock({ detail }: { detail: UpdateContentDetail }) {
  const [expanded, toggleExpanded] = useReducer((open: boolean) => !open, false)
  const changed = countChangedLines(detail.hunks)
  const hunks = expanded ? detail.hunks : collapsedHunks(detail.hunks)
  const hidden = Math.max(0, changed - countChangedLines(hunks))

  return (
    <div className="space-y-2">
      {hunks.map((hunk) => (
        <section
          key={`${hunk.sectionId}-${hunk.section}`}
          className="space-y-1.5"
          aria-label={`Changes in ${hunk.section}`}
        >
          <h4 className="text-xs font-medium text-muted-foreground">
            {hunk.section}
          </h4>
          <div className="space-y-1 font-sans text-sm leading-relaxed [overflow-wrap:anywhere]">
            {hunk.lines.map((line, index) => (
              <p
                key={`${hunk.sectionId}-${index}`}
                className="flex min-w-0 gap-2 whitespace-pre-wrap"
              >
                <span
                  data-slot="diff-line-label"
                  className="w-[3.25rem] shrink-0 pt-0.5 text-xs leading-5 text-muted-foreground"
                >
                  {DIFF_LINE_LABEL[line.kind]}
                </span>
                {line.kind === "add" ? (
                  <DiffInsert>{line.text}</DiffInsert>
                ) : line.kind === "del" ? (
                  <DiffDelete>{line.text}</DiffDelete>
                ) : (
                  <span className="min-w-0">{line.text}</span>
                )}
              </p>
            ))}
          </div>
        </section>
      ))}
      {hidden > 0 || expanded ? (
        <Button
          className="h-11 md:h-8"
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => toggleExpanded()}
        >
          {expanded
            ? "Show fewer changes"
            : `Show ${hidden} more change${hidden === 1 ? "" : "s"}`}
        </Button>
      ) : null}
    </div>
  )
}

function MoveCardBody({
  detail,
}: {
  detail: Extract<CoachReceiptDetail, { type: "job.move" }>
}) {
  const fromLabel = stageLabel(detail.from)
  const toLabel = stageLabel(detail.to)

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
      aria-label={`${fromLabel} to ${toLabel}`}
    >
      {STAGES.map((stage) => {
        const involved = stage.id === detail.from || stage.id === detail.to
        return (
          <span
            key={stage.id}
            className={cn(
              "inline-flex items-center gap-1",
              involved ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span className={cn("size-1.5 rounded-full", stage.dot)} />
            {involved ? (
              <span className="font-medium">{stage.label}</span>
            ) : (
              <span className="sr-only">{stage.label}</span>
            )}
          </span>
        )
      })}
      <span className="text-muted-foreground">
        {fromLabel} → {toLabel}
      </span>
    </div>
  )
}

function CreateDocBody({
  detail,
}: {
  detail: Extract<CoachReceiptDetail, { type: "paper.create" }>
}) {
  const statusLabel =
    detail.status === "published"
      ? "Published"
      : detail.status === "ready"
        ? "Ready"
        : "Draft"

  return (
    <div
      data-slot="coach-doc-card"
      className="w-full max-w-[420px] min-w-0 rounded-lg border border-border bg-card text-sm"
    >
      <p className="flex min-w-0 items-center gap-2 px-3 py-2.5 font-medium text-foreground">
        <FileText className="size-4 shrink-0" aria-hidden />
        {detail.docId ? (
          <Link
            className="min-w-0 truncate hover:underline hover:underline-offset-2"
            to="/paper/$docId"
            params={{ docId: detail.docId }}
          >
            {detail.name}
          </Link>
        ) : (
          <span className="min-w-0 truncate">{detail.name}</span>
        )}
      </p>
      <p className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{PAPER_KIND_LABEL[detail.docKind]}</span>
        <span>{statusLabel}</span>
      </p>
    </div>
  )
}

export function ReceiptDetail({ detail }: { detail: CoachReceiptDetail }) {
  switch (detail.type) {
    case "job.move":
      return <MoveCardBody detail={detail} />
    case "paper.create":
      return <CreateDocBody detail={detail} />
    case "paper.replace":
      return null
  }
}
