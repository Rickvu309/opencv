import type { ReactNode } from "react"
import { Maximize2, Minus, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import "./design/coach-panel.pen.css"
import "./coach-panel-sheet.css"

export type CoachPanelMode = "dock" | "side" | "full"

type CoachPanelProps = {
  title: string
  open: boolean
  mode: CoachPanelMode
  onMinimize: () => void
  onExpand: () => void
  onClose: () => void
  children: (controls: ReactNode) => ReactNode
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
      data-pen-surface="coach"
      data-panel-mode={mode}
      aria-label={title}
      className="flex h-full min-h-0 w-full flex-1 flex-col bg-background duration-(--duration-panel) ease-(--ease-panel)"
    >
      {children(
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-11 shrink-0 rounded-[6px] max-md:hidden md:size-7"
            aria-label="Minimize"
            onClick={onMinimize}
          >
            <Minus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-11 shrink-0 rounded-[6px] max-md:hidden md:size-7"
            aria-label="Expand"
            aria-pressed={mode === "full"}
            onClick={onExpand}
          >
            <Maximize2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-11 shrink-0 rounded-[6px] md:size-7"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </>
      )}
    </section>
  )
}
