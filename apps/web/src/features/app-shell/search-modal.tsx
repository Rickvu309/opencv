import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { Briefcase, FileText, Globe, Search, SquarePen } from "lucide-react"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"
import type { SearchThread } from "@/features/app-shell/search-threads.ts"
import type { SurfaceId } from "@/features/app-shell/surfaces.ts"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  threads: SearchThread[]
  onNewThread: () => void
  onOpenThread: (id: string) => void
  onSurface: (id: SurfaceId) => void
}

const ACTIONS: {
  id: string
  label: string
  icon: typeof SquarePen
  run: "thread" | Exclude<SurfaceId, "home" | "settings">
}[] = [
  { id: "a1", label: "Start a new Thread", icon: SquarePen, run: "thread" },
  { id: "a2", label: "Open Paper", icon: FileText, run: "paper" },
  { id: "a3", label: "Open Apply", icon: Briefcase, run: "apply" },
  { id: "a4", label: "Open Pitch", icon: Globe, run: "pitch" },
]

const RESET_LIST_KEY = "\0false"

type ListItem =
  | { kind: "action"; id: string; run: (typeof ACTIONS)[number]["run"] }
  | { kind: "thread"; id: string }

export function SearchModal({
  open,
  onOpenChange,
  threads,
  onNewThread,
  onOpenThread,
  onSurface,
}: Props) {
  const [query, setQuery] = useState("")
  const [showAllActions, setShowAllActions] = useState(false)
  const [highlight, setHighlight] = useState({
    listKey: RESET_LIST_KEY,
    index: 0,
  })
  const [stickyThreadId, setStickyThreadId] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  const inputRef = useRef<HTMLInputElement>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery("")
      setShowAllActions(false)
      setHighlight({ listKey: RESET_LIST_KEY, index: 0 })
      setStickyThreadId(null)
    }
  }

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [open])

  const q = query.trim().toLowerCase()
  const listKey = `${q}\0${showAllActions}`
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

  const activeIndex =
    highlight.listKey === listKey ? highlight.index : 0
  const activeItem = items[activeIndex]
  const selectedId =
    activeItem?.kind === "thread" ? activeItem.id : stickyThreadId
  const selected = threads.find((t) => t.id === selectedId) ?? null

  function setActiveIndex(updater: number | ((current: number) => number)) {
    const current = highlight.listKey === listKey ? highlight.index : 0
    const index = typeof updater === "function" ? updater(current) : updater
    setHighlight({ listKey, index })
    const item = items[index]
    if (item?.kind === "thread") {
      setStickyThreadId(item.id)
    }
  }

  function runAction(run: (typeof ACTIONS)[number]["run"]) {
    onOpenChange(false)
    if (run === "thread") onNewThread()
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
            <Input
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
              className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-base"
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
                  <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
                    Actions
                  </span>
                  {!q ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-micro text-muted-foreground"
                      onClick={() => setShowAllActions((v) => !v)}
                    >
                      {showAllActions ? "Show less" : "Show all"}
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-0.5">
                  {actions.map((a) => {
                    const Icon = a.icon
                    const highlighted =
                      items[activeIndex]?.kind === "action" &&
                      items[activeIndex].id === a.id
                    return (
                      <Button
                        key={a.id}
                        id={`search-item-${a.id}`}
                        type="button"
                        variant="ghost"
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
                          "h-auto w-full justify-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm",
                          highlighted
                            ? "bg-muted font-medium"
                            : "bg-muted/70 hover:bg-muted"
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{a.label}</span>
                      </Button>
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
                <p className="mb-1.5 px-1 text-micro font-medium tracking-wide text-muted-foreground uppercase">
                  Recent
                </p>
                <div className="space-y-0.5">
                  {recents.map((t) => {
                    const highlighted =
                      items[activeIndex]?.kind === "thread" &&
                      items[activeIndex].id === t.id
                    return (
                      <Button
                        key={t.id}
                        id={`search-item-${t.id}`}
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          const index = items.findIndex(
                            (item) => item.kind === "thread" && item.id === t.id
                          )
                          if (index >= 0) setActiveIndex(index)
                        }}
                        onDoubleClick={() => openThread(t.id)}
                        className={cn(
                          "h-auto w-full justify-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm",
                          highlighted || selectedId === t.id
                            ? "bg-muted font-medium"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {t.title}
                        </span>
                        <span className="shrink-0 text-micro text-muted-foreground">
                          {t.when}
                        </span>
                      </Button>
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
                    <OpenCvLogo size="sm" />
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
                  <Button
                    type="button"
                    className="mt-4 h-auto w-full rounded-xl py-2.5"
                    onClick={() => openThread(selected.id)}
                  >
                    Open Thread
                  </Button>
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
