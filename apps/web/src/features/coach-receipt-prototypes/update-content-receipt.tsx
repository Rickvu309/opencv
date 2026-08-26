import { useState } from "react"
import { FileText } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { PAPER_KIND_LABEL } from "@workspace/domain"
import { cn } from "@workspace/ui/lib/utils"

import {
  collapsedHunks,
  countChangedLines,
  type DiffHunk,
  type UpdateContentFixture,
} from "@/features/coach-receipt-prototypes/fixtures.ts"
import { ReceiptFrame } from "@/features/coach-receipt-prototypes/receipt-frame.tsx"

function DiffView({ hunks }: { hunks: readonly DiffHunk[] }) {
  return (
    <div className="space-y-2">
      {hunks.map((hunk) => (
        <div key={hunk.section}>
          <p className="mb-1 text-[11px] font-medium text-foreground">
            {hunk.section}
          </p>
          <ul className="overflow-hidden rounded-md border border-border bg-background font-mono text-[11px] leading-relaxed">
            {hunk.lines.map((line, index) => (
              <li
                key={`${hunk.section}-${index}`}
                className={cn(
                  "flex gap-2 px-2 py-1",
                  line.kind === "add" && "bg-emerald-50 text-emerald-900",
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

export function UpdateContentReceipt({
  fixture,
  ok,
  errorSummary,
  onOpen,
}: {
  fixture: UpdateContentFixture
  ok: boolean
  errorSummary?: string
  onOpen?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const changed = countChangedLines(fixture.hunks)
  const hunks = expanded ? fixture.hunks : collapsedHunks(fixture.hunks)
  const hidden = Math.max(0, changed - countChangedLines(hunks))

  return (
    <ReceiptFrame
      ok={ok}
      headline={
        ok
          ? `Updated ${PAPER_KIND_LABEL[fixture.kind]} ${fixture.docName}`
          : (errorSummary ?? fixture.summary)
      }
      reversal={ok ? fixture.reversal : undefined}
    >
      <div className="ml-5 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{PAPER_KIND_LABEL[fixture.kind]}</Badge>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3" aria-hidden />
            {fixture.docName}
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
        {onOpen ? (
          <Button type="button" variant="outline" size="xs" onClick={onOpen}>
            Open in Paper
          </Button>
        ) : null}
      </div>
    </ReceiptFrame>
  )
}
