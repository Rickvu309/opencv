import { Check, X } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

export function ReceiptFrame({
  ok,
  headline,
  reversal,
  children,
}: {
  ok: boolean
  headline: string
  reversal?: string
  children?: ReactNode
}) {
  const Icon = ok ? Check : X
  return (
    <div
      role="status"
      aria-label={ok ? "Command succeeded" : "Command failed"}
      className="space-y-2 text-xs text-muted-foreground"
    >
      <p className="flex items-start gap-1.5 text-foreground">
        <Icon
          className={cn(
            "mt-0.5 size-3 shrink-0",
            ok ? "text-emerald-600" : "text-destructive"
          )}
          aria-hidden
        />
        <span className="font-medium">{headline}</span>
      </p>
      {ok ? children : null}
      {ok && reversal ? <p className="pl-5">Reversible — {reversal}</p> : null}
    </div>
  )
}

export function CompareBlock({
  label = "Live generic receipt",
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}
