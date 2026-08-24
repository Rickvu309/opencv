import { useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { Briefcase, FileText, Globe, Search, SquarePen } from "lucide-react"

import { OpenPathLogo } from "@/features/app-shell/app-logo.tsx"
import { FOCUS_RING } from "@/features/app-shell/focus-ring.ts"
import type { SurfaceId } from "@/features/app-shell/surfaces.ts"
import type { HomeThread } from "@/features/home/threads.ts"

type SearchThread = {
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
  { id: "a1", label: "Start a new Thread", icon: SquarePen, run: "chat" },
  { id: "a2", label: "Open Paper", icon: FileText, run: "paper" },
  { id: "a3", label: "Open Apply", icon: Briefcase, run: "apply" },
  { id: "a4", label: "Open Pitch", icon: Globe, run: "pitch" },
]

type ListItem =
  | { kind: "action"; id: string; run: (typeof ACTIONS)[number]["run"] }
  | { kind: "thread"; id: string }

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
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery("")
    setSelectedId(null)
    setShowAllActions(false)
    setActiveIndex(0)
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

  const items = useMemo<ListItem[]>(
    () => [
      ...actions.map((action) => ({
        kind: "action" as const,
        id: action.id,
        run: action.run,
      })),
      ...recents.map((thread) => ({ kind: "thread" as const, id: thread.id })),
    ],
    [actions, recents]
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [q, showAllActions])

  useEffect(() => {
    const item = items[activeIndex]
    if (item?.kind === "thread") {
      setSelectedId(item.id)
    }
  }, [activeIndex, items])

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

  function activate(item: ListItem | undefined) {
    if (!item) return
    if (item.kind === "action") runAction(item.run)
    else openThread(item.id)
  }

  function moveActive(delta: number) {
    if (items.length === 0) return
    setActiveIndex((current) => {
      const next = (current + delta + items.length) % items.length
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/40 backdrop-blur-[1px] supports-backdrop-filter:backdrop-blur-[1px]"
        aria-describedby={undefined}
        className="top-[8vh] flex h-[min(520px,82vh)] w-full max-w-[calc(100%-1.5rem)] translate-y-0 gap-0 overflow-hidden rounded-2xl bg-background p-0 text-foreground ring-1 ring-border sm:top-[12vh] sm:h-[min(520px,70vh)] sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  moveActive(1)
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  moveActive(-1)
                } else if (e.key === "Enter") {
                  e.preventDefault()
                  activate(items[activeIndex])
                }
              }}
              placeholder="Search…"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              aria-label="Search"
              aria-controls="search-results"
              aria-activedescendant={
                items[activeIndex]
                  ? `search-item-${items[activeIndex]!.id}`
                  : undefined
              }
            />
            <Search className="size-4 shrink-0 text-muted-foreground" />
          </div>

          <div className="flex min-h-0 flex-1 max-sm:flex-col">
            <div
              id="search-results"
              className="flex w-full shrink-0 flex-col overflow-auto border-border max-sm:max-h-[48%] max-sm:border-b sm:w-[42%] sm:border-r"
            >
              <div className="px-3 pt-3">
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Actions
                  </span>
                  {!q ? (
                    <button
                      type="button"
                      className={cn(
                        FOCUS_RING,
                        "rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setShowAllActions((v) => !v)}
                    >
                      {showAllActions ? "Show less" : "Show all"}
                    </button>
                  ) : null}
                </div>
                <div className="space-y-0.5">
                  {actions.map((a) => {
                    const Icon = a.icon
                    const highlighted =
                      items[activeIndex]?.kind === "action" &&
                      items[activeIndex].id === a.id
                    return (
                      <button
                        key={a.id}
                        id={`search-item-${a.id}`}
                        type="button"
                        onClick={() => runAction(a.run)}
                        onMouseEnter={() =>
                          setActiveIndex(
                            items.findIndex(
                              (item) =>
                                item.kind === "action" && item.id === a.id
                            )
                          )
                        }
                        className={cn(
                          FOCUS_RING,
                          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm",
                          highlighted
                            ? "bg-muted font-medium"
                            : "bg-muted/70 hover:bg-muted"
                        )}
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
                  Recent
                </p>
                <div className="space-y-0.5">
                  {recents.map((t) => {
                    const highlighted =
                      items[activeIndex]?.kind === "thread" &&
                      items[activeIndex].id === t.id
                    return (
                      <button
                        key={t.id}
                        id={`search-item-${t.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedId(t.id)
                          const index = items.findIndex(
                            (item) => item.kind === "thread" && item.id === t.id
                          )
                          if (index >= 0) setActiveIndex(index)
                        }}
                        onDoubleClick={() => openThread(t.id)}
                        className={cn(
                          FOCUS_RING,
                          "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                          highlighted || selectedId === t.id
                            ? "bg-muted font-medium"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {t.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {t.when}
                        </span>
                      </button>
                    )
                  })}
                  {recents.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No conversations
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-muted/20 p-4 sm:p-6">
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
                      "Open this Thread to continue with Coach."}
                  </p>
                  <button
                    type="button"
                    className={cn(
                      FOCUS_RING,
                      "mt-4 w-full rounded-xl bg-foreground py-2.5 text-sm font-medium text-background"
                    )}
                    onClick={() => openThread(selected.id)}
                  >
                    Open Thread
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
      </DialogContent>
    </Dialog>
  )
}
