import { useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown } from "lucide-react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { useThreadStore } from "@/features/home/use-thread-store.ts"
import { HISTORY_PREVIEW_COUNT } from "@/features/home/threads.ts"

type Props = {
  collapsed: boolean
}

export function SidebarHistory({ collapsed }: Props) {
  const { threads, activeThreadId, openThread } = useThreadStore()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const onHome = pathname === SURFACE_PATHS.home
  const [historyOpen, setHistoryOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const preview = showAll ? threads : threads.slice(0, HISTORY_PREVIEW_COUNT)

  function handleOpen(id: string) {
    openThread(id)
    if (!onHome) {
      void navigate({ to: SURFACE_PATHS.home })
    }
  }

  return (
    <div
      className={cn(
        "mt-2 flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 transition-opacity duration-200",
        collapsed ? "pointer-events-none opacity-0" : "opacity-100"
      )}
      aria-hidden={collapsed}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          className="flex w-full items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground"
          aria-expanded={historyOpen}
          aria-controls="sidebar-history-list"
          onClick={() => setHistoryOpen((open) => !open)}
        >
          History
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              !historyOpen && "-rotate-90"
            )}
          />
        </button>
        {historyOpen ? (
          <nav
            id="sidebar-history-list"
            aria-label="History"
            className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-auto"
          >
            {preview.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => handleOpen(thread.id)}
                className={cn(
                  "w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm",
                  activeThreadId === thread.id && onHome
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {thread.title}
              </button>
            ))}
            {threads.length > HISTORY_PREVIEW_COUNT ? (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className="w-full px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showAll ? "Show less" : "See all"}
              </button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  )
}
