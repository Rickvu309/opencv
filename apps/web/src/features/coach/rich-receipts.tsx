import { useReducer } from "react"
import { FilePlus, FileText } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@workspace/ui/components/code-block"
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

export function DiffBlock({ detail }: { detail: UpdateContentDetail }) {
  const [expanded, toggleExpanded] = useReducer((open: boolean) => !open, false)
  const changed = countChangedLines(detail.hunks)
  const hunks = expanded ? detail.hunks : collapsedHunks(detail.hunks)
  const hidden = Math.max(0, changed - countChangedLines(hunks))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge variant="outline">{PAPER_KIND_LABEL[detail.docKind]}</Badge>
        <span className="inline-flex items-center gap-1">
          <FileText className="size-3" aria-hidden />
          {detail.docId ? (
            <a
              className="underline underline-offset-2"
              href={`/paper/${detail.docId}`}
            >
              {detail.docName} · Open
            </a>
          ) : (
            detail.docName
          )}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {changed} change{changed === 1 ? "" : "s"}
      </p>
      {hunks.map((hunk) => (
        <CodeBlock key={`${hunk.sectionId}-${hunk.section}`} size="sm">
          <CodeBlockHeader>
            <CodeBlockTitle>{hunk.section}</CodeBlockTitle>
          </CodeBlockHeader>
          <CodeBlockContent wrap aria-label={`Changes in ${hunk.section}`}>
            {hunk.lines.map((line, index) => (
              <CodeBlockLine
                key={`${hunk.sectionId}-${index}`}
                variant={
                  line.kind === "add"
                    ? "added"
                    : line.kind === "del"
                      ? "removed"
                      : "default"
                }
              >
                {line.kind === "add" ? (
                  <ins className="no-underline">{line.text}</ins>
                ) : line.kind === "del" ? (
                  <del>{line.text}</del>
                ) : (
                  line.text
                )}
              </CodeBlockLine>
            ))}
          </CodeBlockContent>
        </CodeBlock>
      ))}
      {hidden > 0 || expanded ? (
        <Button
          className="h-11 md:h-6"
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
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Badge variant="outline">{PAPER_KIND_LABEL[detail.docKind]}</Badge>
      <Badge variant="secondary">{statusLabel}</Badge>
      <span className="inline-flex items-center gap-1">
        <FilePlus className="size-3" aria-hidden />
        {detail.docId ? (
          <a
            className="underline underline-offset-2"
            href={`/paper/${detail.docId}`}
          >
            {detail.name}
          </a>
        ) : (
          detail.name
        )}
      </span>
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
