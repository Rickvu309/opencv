import { useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import {
  Briefcase,
  FileText,
  Globe,
  Maximize2,
  Search,
  SquarePen,
} from "lucide-react"

import { OpenPathLogo } from "@/features/app-shell/app-logo.tsx"
import type { SurfaceId } from "@/features/app-shell/surfaces.ts"
import type { HomeThread } from "@/features/home/threads.ts"

export type SearchThread = {
  id: string
  title: string
  when: string
  preview?: string
}

export function searchThreadsFromHome(threads: HomeThread[]): SearchThread[] {
  return threads.map((thread, index) => {
    const preview = [...thread.messages]
      .reverse()
      .find((message) => message.role === "coach")?.text

    return {
      id: thread.id,
      title: thread.title,
      when: index === 0 ? "Today" : index === 1 ? "Yesterday" : "Earlier",
      preview,
    }
  })
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  threads: SearchThread[]
  onNewChat: () => void
  onOpenThread: (id: string) => void
  onSurface: (id: SurfaceId) => void
}

const ACTIONS: {
  id: string
  label: string
  icon: typeof SquarePen
  run: "chat" | Exclude<SurfaceId, "home" | "settings">
}[] = [
  { id: "a1", label: "Create new private chat", icon: SquarePen, run: "chat" },
  { id: "a2", label: "Open Paper", icon: FileText, run: "paper" },
  { id: "a3", label: "Open Apply", icon: Briefcase, run: "apply" },
  { id: "a4", label: "Open Pitch", icon: Globe, run: "pitch" },
]

export function SearchModal({
  open,
  onOpenChange,
  threads,
  onNewChat,
  onOpenThread,
  onSurface,
}: Props) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAllActions, setShowAllActions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery("")
    setSelectedId(null)
    setShowAllActions(false)
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [open])

  const q = query.trim().toLowerCase()
  const actions = useMemo(() => {
    const list = showAllActions ? ACTIONS : ACTIONS.slice(0, 1)
    if (!q) return list
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(q))
  }, [q, showAllActions])

  const recents = useMemo(() => {
    if (!q) return threads
    return threads.filter((t) => t.title.toLowerCase().includes(q))
  }, [q, threads])

  const selected = threads.find((t) => t.id === selectedId) ?? null

  function runAction(run: (typeof ACTIONS)[number]["run"]) {
    onOpenChange(false)
    if (run === "chat") onNewChat()
    else onSurface(run)
  }

  function openThread(id: string) {
    onOpenChange(false)
    onOpenThread(id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/40 backdrop-blur-[1px] supports-backdrop-filter:backdrop-blur-[1px]"
        aria-describedby={undefined}
        className="top-[12vh] flex h-[min(520px,70vh)] w-full max-w-3xl translate-y-0 gap-0 overflow-hidden rounded-2xl bg-background p-0 text-foreground ring-1 ring-border sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              aria-label="Search"
            />
            <Search className="size-4 shrink-0 text-muted-foreground" />
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="flex w-[42%] shrink-0 flex-col overflow-auto border-r border-border">
              <div className="px-3 pt-3">
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Actions
                  </span>
                  {!q ? (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAllActions((v) => !v)}
                    >
                      {showAllActions ? "Show less" : "Show all"}
                    </button>
                  ) : null}
                </div>
                <div className="space-y-0.5">
                  {actions.map((a) => {
                    const Icon = a.icon
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => runAction(a.run)}
                        className="flex w-full items-center gap-2.5 rounded-xl bg-muted/70 px-3 py-2.5 text-left text-sm hover:bg-muted"
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{a.label}</span>
                      </button>
                    )
                  })}
                  {actions.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No actions
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 px-3 pb-3">
                <p className="mb-1.5 px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Today
                </p>
                <div className="space-y-0.5">
                  {recents.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      onDoubleClick={() => openThread(t.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        selectedId === t.id
                          ? "bg-muted font-medium"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {t.when}
                      </span>
                    </button>
                  ))}
                  {recents.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No conversations
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-muted/20 p-6">
              {selected ? (
                <div className="w-full max-w-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <OpenPathLogo size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {selected.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selected.when}
                      </p>
                    </div>
                  </div>
                  <p className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground">
                    {selected.preview ??
                      "Open this chat to continue with Coach."}
                  </p>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl bg-foreground py-2.5 text-sm font-medium text-background"
                    onClick={() => openThread(selected.id)}
                  >
                    Open chat
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a conversation to preview
                </p>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="absolute bottom-2 left-2 rounded p-1 text-muted-foreground/50 hover:text-muted-foreground"
          aria-label="Resize"
          tabIndex={-1}
        >
          <Maximize2 className="size-3.5" />
        </button>
      </DialogContent>
    </Dialog>
  )
}
