import type { ReactNode } from "react"
import { Maximize2, Minus, X } from "lucide-react"

import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { Button } from "@workspace/ui/components/button"

export type CoachPanelMode = "dock" | "side" | "full"

type CoachPanelProps = {
  title: string
  open: boolean
  mode: CoachPanelMode
  onMinimize: () => void
  onExpand: () => void
  onClose: () => void
  children?: ReactNode
}

export function CoachPanel({
  title,
  open,
  mode,
  onMinimize,
  onExpand,
  onClose,
  children,
}: CoachPanelProps) {
  if (!open) return null

  return (
    <section
      data-slot="coach-panel"
      aria-label={title}
      className="flex h-full min-h-0 flex-col bg-background duration-(--duration-panel) ease-(--ease-panel)"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {title}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={shellCopy.minimize}
          onClick={onMinimize}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={shellCopy.expand}
          aria-pressed={mode === "full"}
          onClick={onExpand}
        >
          <Maximize2 />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={shellCopy.close}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}
