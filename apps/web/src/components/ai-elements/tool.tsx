import type { ComponentProps, ReactNode } from "react"
import { Check, X } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export type ToolState = "completed" | "error"

export function Tool({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="tool"
      className={cn(
        "max-w-full min-w-0 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export function ToolHeader({
  state,
  children,
}: {
  state: ToolState
  children: ReactNode
}) {
  const Icon = state === "completed" ? Check : X
  return (
    <p data-slot="tool-header" className="flex min-w-0 items-start gap-1.5">
      <Icon
        className={cn(
          "mt-0.5 size-3 shrink-0",
          state === "completed" ? "text-success" : "text-destructive"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere] break-words text-foreground">
        {children}
      </span>
    </p>
  )
}

export function ToolContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="tool-content"
      className={cn("mt-1 min-w-0 space-y-1 pl-[1.125rem]", className)}
      {...props}
    />
  )
}
