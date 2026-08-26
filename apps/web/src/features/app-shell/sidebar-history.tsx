import { useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown, Trash2 } from "lucide-react"

import { FOCUS_RING } from "@/features/app-shell/focus-ring.ts"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { DestructiveCommandDialog } from "@/features/commands/destructive-command-dialog.tsx"
import { HISTORY_PREVIEW_COUNT } from "@/features/home/threads.ts"
import { useThreadList } from "@/features/home/use-thread-list.ts"

type Props = {
  collapsed: boolean
  onNavigate?: () => void
}

export function SidebarHistory({ collapsed, onNavigate }: Props) {
  const { threads, activeThreadId, openThread, deleteThread } = useThreadList()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const onHome = pathname === SURFACE_PATHS.home
  const [historyOpen, setHistoryOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)
  const preview = showAll ? threads : threads.slice(0, HISTORY_PREVIEW_COUNT)

  function handleOpen(id: string) {
    openThread(id)
    if (!onHome) {
      void navigate({ to: SURFACE_PATHS.home })
    }
    onNavigate?.()
  }

  return (
    <div
      className={cn(
        "mt-2 flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 transition-opacity duration-200",
        collapsed ? "pointer-events-none opacity-0" : "opacity-100"
      )}
      aria-hidden={collapsed}
      inert={collapsed || undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          className={cn(
            FOCUS_RING,
            "flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground"
          )}
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
              <div
                key={thread.id}
                className="group flex items-center rounded-md"
              >
                <button
                  type="button"
                  onClick={() => handleOpen(thread.id)}
                  aria-current={
                    activeThreadId === thread.id ? "true" : undefined
                  }
                  className={cn(
                    FOCUS_RING,
                    "min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm",
                    activeThreadId === thread.id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {thread.title}
                </button>
                <button
                  type="button"
                  aria-label="Delete Thread"
                  onClick={() => setDeleteTarget(thread)}
                  className={cn(
                    FOCUS_RING,
                    "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-focus-within:opacity-100 group-hover:opacity-100"
                  )}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {threads.length > HISTORY_PREVIEW_COUNT ? (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className={cn(
                  FOCUS_RING,
                  "w-full rounded-md px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                {showAll ? "Show less" : "See all"}
              </button>
            ) : null}
          </nav>
        ) : null}
      </div>
      <DestructiveCommandDialog
        open={Boolean(deleteTarget)}
        title="Delete Thread"
        name={deleteTarget?.title ?? null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (!deleteTarget) return
          const id = deleteTarget.id
          setDeleteTarget(null)
          deleteThread(id)
        }}
      />
    </div>
  )
}
