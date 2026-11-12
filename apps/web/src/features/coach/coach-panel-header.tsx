import type { ReactNode } from "react"
import { SquarePen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

export function CoachPanelHeader({
  history,
  showNewChat,
  onNewChat,
  children,
}: {
  history: ReactNode
  showNewChat: boolean
  onNewChat: () => void
  children?: ReactNode
}) {
  return (
    <div
      data-slot="coach-panel-header"
      className="flex h-12 min-w-0 shrink-0 items-center gap-[6px] border-b border-border/50 ps-4 pe-2"
    >
      <h1 className="sr-only">Coach</h1>
      {history}
      <span className="flex-1" />
      {showNewChat ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New chat"
          className="max-md:size-11"
          onClick={onNewChat}
        >
          <SquarePen className="size-4" />
        </Button>
      ) : null}
      {children}
    </div>
  )
}
