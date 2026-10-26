import { useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown, Trash2 } from "lucide-react"
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
        "mt-2 flex max-h-48 min-h-0 shrink-0 flex-col overflow-hidden px-1.5 transition-opacity",
        collapsed ? "pointer-events-none opacity-0" : "opacity-100"
      )}
      aria-hidden={collapsed}
      inert={collapsed || undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start gap-1 px-2 py-1 text-xs font-medium text-muted-foreground"
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
        </Button>
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpen(thread.id)}
                  aria-current={
                    activeThreadId === thread.id ? "true" : undefined
                  }
                  className={cn(
                    "h-auto min-w-0 flex-1 justify-start truncate px-2.5 py-1.5 text-left text-sm",
                    activeThreadId === thread.id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {thread.title}
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete Thread"
                  onClick={() => setDeleteTarget(thread)}
                  className="text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            {threads.length > HISTORY_PREVIEW_COUNT ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className="h-auto w-full justify-start px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                {showAll ? "Show less" : "See all"}
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
      {deleteTarget ? (
        <DestructiveCommandDialog
          open
          title="Delete Thread"
          name={deleteTarget.title}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onConfirm={() => {
            const id = deleteTarget.id
            setDeleteTarget(null)
            deleteThread(id)
          }}
        />
      ) : null}
    </div>
  )
}
