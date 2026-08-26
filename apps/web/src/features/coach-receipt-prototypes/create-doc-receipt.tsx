import { FilePlus } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { PAPER_KIND_LABEL } from "@workspace/domain"

import type { CreateDocFixture } from "@/features/coach-receipt-prototypes/fixtures.ts"
import { ReceiptFrame } from "@/features/coach-receipt-prototypes/receipt-frame.tsx"

export function CreateDocReceipt({
  fixture,
  ok,
  errorSummary,
  onOpen,
}: {
  fixture: CreateDocFixture
  ok: boolean
  errorSummary?: string
  onOpen?: () => void
}) {
  const kindLabel = PAPER_KIND_LABEL[fixture.kind]

  return (
    <ReceiptFrame
      ok={ok}
      headline={
        ok
          ? `Created ${kindLabel} ${fixture.name}`
          : (errorSummary ?? fixture.summary)
      }
      reversal={ok ? fixture.reversal : undefined}
    >
      <div className="ml-5 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{kindLabel}</Badge>
          <Badge variant="secondary">Draft</Badge>
          <span className="inline-flex items-center gap-1">
            <FilePlus className="size-3" aria-hidden />
            {fixture.name}
          </span>
        </div>
        <div
          aria-label={`${kindLabel} first-page preview`}
          className="w-44 rounded-md border border-border bg-card px-3 py-3 shadow-[0_1px_2px_oklch(0_0_0/0.04)]"
        >
          <p className="font-[ui-serif,Georgia,Cambria,serif] text-xs font-medium text-foreground">
            {fixture.previewTitle}
          </p>
          {fixture.previewLines.map((line) => (
            <p key={line} className="mt-1 text-[10px] leading-relaxed">
              {line}
            </p>
          ))}
        </div>
        {onOpen ? (
          <Button type="button" variant="outline" size="xs" onClick={onOpen}>
            Open in Paper
          </Button>
        ) : null}
      </div>
    </ReceiptFrame>
  )
}
