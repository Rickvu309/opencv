import { useState } from "react"
import { FilePlus, FileText } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  PAPER_KIND_LABEL,
  collapsedHunks,
  countChangedLines,
  type CoachReceiptDetail,
} from "@workspace/domain"

import { STAGES } from "@/features/apply/apply-types.ts"

function stageLabel(stage: string) {
  return STAGES.find((item) => item.id === stage)?.label ?? stage
}

function DiffView({
  hunks,
}: {
  hunks: Extract<CoachReceiptDetail, { type: "paper.updateContent" }>["hunks"]
}) {
  return (
    <div className="space-y-2">
      {hunks.map((hunk) => (
        <div key={`${hunk.sectionId}-${hunk.section}`}>
          <p className="mb-1 text-[11px] font-medium text-foreground">
            {hunk.section}
          </p>
          <ul className="overflow-hidden rounded-md border border-border bg-background font-mono text-[11px] leading-relaxed">
            {hunk.lines.map((line, index) => (
              <li
                key={`${hunk.sectionId}-${index}`}
                className={cn(
                  "flex gap-2 px-2 py-1",
                  line.kind === "add" && "bg-success/10 text-success",
                  line.kind === "del" && "bg-destructive/10 text-destructive",
                  line.kind === "eq" && "text-muted-foreground"
                )}
              >
                <span aria-hidden className="w-3 shrink-0">
                  {line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}
                </span>
                {line.kind === "add" ? (
                  <ins className="no-underline">{line.text}</ins>
                ) : line.kind === "del" ? (
                  <del>{line.text}</del>
                ) : (
                  <span>{line.text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function UpdateContentBody({
  detail,
}: {
  detail: Extract<CoachReceiptDetail, { type: "paper.updateContent" }>
}) {
  const [expanded, setExpanded] = useState(false)
  const changed = countChangedLines(detail.hunks)
  const hunks = expanded ? detail.hunks : collapsedHunks(detail.hunks)
  const hidden = Math.max(0, changed - countChangedLines(hunks))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{PAPER_KIND_LABEL[detail.docKind]}</Badge>
        <span className="inline-flex items-center gap-1">
          <FileText className="size-3" aria-hidden />
          {detail.docName}
        </span>
      </div>
      <DiffView hunks={hunks} />
      {hidden > 0 || expanded ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setExpanded((value) => !value)}
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
  detail: Extract<CoachReceiptDetail, { type: "apply.moveCard" }>
}) {
  const fromLabel = stageLabel(detail.from)
  const toLabel = stageLabel(detail.to)

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
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
              <span className="text-[11px] font-medium">{stage.label}</span>
            ) : (
              <span className="sr-only">{stage.label}</span>
            )}
          </span>
        )
      })}
      <span className="text-[11px] text-muted-foreground">
        {fromLabel} → {toLabel}
      </span>
    </div>
  )
}

function CreateDocBody({
  detail,
}: {
  detail: Extract<CoachReceiptDetail, { type: "paper.createDoc" }>
}) {
  const kindLabel = PAPER_KIND_LABEL[detail.docKind]
  const statusLabel =
    detail.status === "published"
      ? "Published"
      : detail.status === "ready"
        ? "Ready"
        : "Draft"

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline">{kindLabel}</Badge>
      <Badge variant="secondary">{statusLabel}</Badge>
      <span className="inline-flex items-center gap-1">
        <FilePlus className="size-3" aria-hidden />
        {detail.name}
      </span>
    </div>
  )
}

export function RichReceiptBody({ detail }: { detail: CoachReceiptDetail }) {
  switch (detail.type) {
    case "paper.updateContent":
      return <UpdateContentBody detail={detail} />
    case "apply.moveCard":
      return <MoveCardBody detail={detail} />
    case "paper.createDoc":
      return <CreateDocBody detail={detail} />
  }
}
