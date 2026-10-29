import { useEffect, useRef, useState } from "react"

import { focusSearchButton } from "./focus-search-button.ts"

import { requestShellChat } from "@/features/command-palette/shell-chat.ts"
import {
  PALETTE_SCOPES,
  listPaletteChats,
  paletteRows,
  rowProperties,
  searchWorkspace,
  type PaletteChat,
  type PaletteRow,
  type PaletteScope,
  type SearchHits,
} from "@/features/command-palette/palette-search.ts"
import type { SurfaceId } from "@/lib/product-paths.ts"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

const copy = {
  empty: (query: string) => `No results for "${query}"`,
  helper: "Try another word, or clear the search.",
  failed: "Could not search. Try again.",
  pages: "Pages",
  jobs: "Jobs",
  paper: "Paper",
  chats: "Chats",
} as const

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSurface: (id: SurfaceId) => void
}

function rowLabel(row: PaletteRow) {
  if (row.kind === "page") return row.label
  if (row.kind === "job") return row.title
  if (row.kind === "paper") return row.name
  return row.title
}

function RowDetail({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-col items-start">
      <span className="text-sm text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </span>
  )
}

export function CommandPalette({
  open,
  onOpenChange,
  onSurface,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<PaletteScope>("all")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hits, setHits] = useState<SearchHits | null>(null)
  const [recent, setRecent] = useState<PaletteChat[]>([])
  const [failed, setFailed] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  const sawOpen = useRef(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery("")
      setScope("all")
      setActiveId(null)
      setHits(null)
      setFailed(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    const wasOpen = sawOpen.current
    sawOpen.current = open
    if (wasOpen && !open) return focusSearchButton()
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listPaletteChats().then((chats) => {
      if (!cancelled) setRecent(chats)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (!trimmed) return
    let cancelled = false
    void searchWorkspace(trimmed).then(
      (next) => {
        if (cancelled) return
        setHits(next)
        setFailed(false)
      },
      () => {
        if (cancelled) return
        setFailed(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [open, query])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopImmediatePropagation()
      onOpenChange(false)
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open, onOpenChange])

  const trimmed = query.trim()
  const rows = paletteRows({ query, scope, hits, recent, failed })
  const active = rows.find((row) => row.id === activeId) ?? rows[0] ?? null
  const waiting = trimmed.length > 0 && hits === null && !failed
  const groups = [
    { label: copy.pages, kind: "page" },
    { label: copy.jobs, kind: "job" },
    { label: copy.paper, kind: "paper" },
    { label: copy.chats, kind: "chat" },
  ] as const

  function move(delta: number) {
    if (!active || rows.length === 0) return
    const index = rows.findIndex((row) => row.id === active.id)
    const next = (index + delta + rows.length) % rows.length
    setActiveId(rows[next]!.id)
  }

  function activate(row: PaletteRow) {
    onOpenChange(false)
    if (row.kind === "page") {
      onSurface(row.surface)
      return
    }
    if (row.kind === "job") {
      onSurface("apply")
      return
    }
    if (row.kind === "paper") {
      onSurface("paper")
      return
    }
    const chatId = row.id.slice("chat:".length)
    requestShellChat({ title: row.title, chatId })
  }

  function onQuery(value: string) {
    setQuery(value)
    if (value.trim()) setFailed(false)
    else setHits(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-background p-0 text-foreground ring-1 ring-border duration-(--duration-panel) ease-(--ease-panel) sm:top-[12vh] sm:left-1/2 sm:h-[min(32rem,70vh)] sm:max-w-3xl sm:-translate-x-1/2 sm:translate-y-0 sm:rounded-xl"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="border-b border-border px-4 py-3">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                move(1)
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                move(-1)
              } else if (event.key === "Enter") {
                event.preventDefault()
                if (active) activate(active)
              }
            }}
            aria-label="Search"
            aria-controls="palette-results"
            aria-activedescendant={
              active ? `palette-row-${active.id}` : undefined
            }
            className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
          />
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
          {PALETTE_SCOPES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={scope === item.id ? "secondary" : "ghost"}
              aria-pressed={scope === item.id}
              onClick={() => setScope(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div
          id="palette-results"
          className="min-h-0 flex-1 overflow-auto px-2 py-2"
        >
          {failed ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              {copy.failed}
            </p>
          ) : null}
          {!failed && !waiting && trimmed && rows.length === 0 ? (
            <div className="px-3 py-6">
              <p className="text-sm text-foreground">{copy.empty(trimmed)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.helper}
              </p>
            </div>
          ) : null}
          {groups.map((group) => {
            const items = rows.filter((row) => row.kind === group.kind)
            if (items.length === 0) return null
            return (
              <div key={group.kind} className="pb-2">
                <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                  {group.label}
                </p>
                {items.map((row) => {
                  const current = active?.id === row.id
                  return (
                    <Button
                      key={row.id}
                      id={`palette-row-${row.id}`}
                      type="button"
                      variant="ghost"
                      aria-current={current ? "true" : undefined}
                      aria-label={
                        row.kind === "paper"
                          ? `${row.name} ${row.kindLabel}`
                          : undefined
                      }
                      onMouseEnter={() => setActiveId(row.id)}
                      onClick={() => activate(row)}
                      className={cn(
                        "h-auto w-full justify-start px-3 py-2 text-left whitespace-normal",
                        current && "bg-muted"
                      )}
                    >
                      {row.kind === "job" ? (
                        <RowDetail title={row.title} detail={row.company} />
                      ) : row.kind === "paper" ? (
                        <RowDetail title={row.name} detail={row.kindLabel} />
                      ) : (
                        <span className="min-w-0 truncate text-sm">
                          {rowLabel(row)}
                        </span>
                      )}
                    </Button>
                  )
                })}
              </div>
            )
          })}
        </div>
        <p
          data-slot="palette-properties"
          className="border-t border-border px-4 py-3 text-sm text-muted-foreground"
        >
          {active ? rowProperties(active) : ""}
        </p>
      </DialogContent>
    </Dialog>
  )
}
