import { Check, X } from "lucide-react"
import type { ThreadToolPart } from "@workspace/domain"

import { cn } from "@workspace/ui/lib/utils"

import { receiptHeadline } from "@/features/home/coach-receipt.ts"

/** Visual clone of the live Thread receipt. Do not change production. */
export function GenericReceiptLine({ part }: { part: ThreadToolPart }) {
  const Icon = part.ok ? Check : X
  return (
    <div
      role="status"
      aria-label={
        part.ok ? "Generic receipt succeeded" : "Generic receipt failed"
      }
      className="min-w-0 max-w-full space-y-0.5 text-xs text-muted-foreground"
    >
      <p className="flex min-w-0 items-start gap-1.5">
        <Icon
          className={cn(
            "mt-0.5 size-3 shrink-0",
            part.ok ? "text-emerald-600" : "text-destructive"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
          {receiptHeadline(part)}
        </span>
      </p>
      {part.ok && part.reversal?.possible ? (
        <p className="pl-5">Reversible — {part.reversal.description}</p>
      ) : null}
    </div>
  )
}
