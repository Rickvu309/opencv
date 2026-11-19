import { useEffect, useReducer, useRef } from "react"
import { useShortcut } from "@/lib/use-shortcut.ts"
import { useNavigate } from "@tanstack/react-router"
import {
  Briefcase,
  FileText,
  type LucideIcon,
  MessageCircle,
  X,
} from "lucide-react"

import { focusSearchButton } from "./focus-search-button.ts"

import {
  initialPaletteState,
  paletteReducer,
} from "@/features/command-palette/command-palette.reducer.ts"
import { requestShellChat } from "@/features/command-palette/shell-chat.ts"
import {
  PALETTE_SCOPES,
  listPaletteChats,
  paletteRows,
  rowProperties,
  searchWorkspace,
  type PaletteRow,
} from "@/features/command-palette/palette-search.ts"
import type { SurfaceId } from "@/lib/product-paths.ts"
import { SURFACE_ICONS } from "@/lib/surface-icons.ts"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Kbd } from "@workspace/ui/components/kbd"
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

function rowIcon(row: PaletteRow): LucideIcon {
  if (row.kind === "page") return SURFACE_ICONS[row.surface]
  if (row.kind === "job") return Briefcase
  if (row.kind === "paper") return FileText
  return MessageCircle
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
  const resultsRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [
    { query, scope, activeId, hits, recent, failed, wasOpen, searchAttempt },
    dispatch,
  ] = useReducer(paletteReducer, open, initialPaletteState)
  const sawOpen = useRef(false)

  if (open !== wasOpen) dispatch({ type: open ? "opened" : "closed" })

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
      if (!cancelled) dispatch({ type: "recent_loaded", chats })
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
        dispatch({ type: "search_succeeded", hits: next })
      },
      () => {
        if (cancelled) return
        dispatch({ type: "search_failed" })
      }
    )
    return () => {
      cancelled = true
    }
  }, [open, query, searchAttempt])

  useShortcut({
    key: "Escape",
    enabled: open,
    inFields: true,
    capture: true,
    stop: true,
    onPress: () => onOpenChange(false),
  })

  const trimmed = query.trim()
  const rows = paletteRows({ query, scope, hits, recent, failed })
  const active = rows.find((row) => row.id === activeId) ?? rows[0] ?? null
  const waiting = trimmed.length > 0 && hits === null && !failed

  useEffect(() => {
    if (!open || !active) return
    resultsRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" })
  }, [active, open])
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
    dispatch({ type: "row_focused", id: rows[next]!.id })
  }

  function activate(row: PaletteRow) {
    onOpenChange(false)
    if (row.kind === "page") {
      onSurface(row.surface)
      return
    }
    if (row.kind === "job") {
      void navigate({
        to: "/apply/$jobId",
        params: { jobId: row.id.slice("job:".length) },
      })
      return
    }
    if (row.kind === "paper") {
      void navigate({
        to: "/paper/$docId",
        params: { docId: row.id.slice("paper:".length) },
      })
      return
    }
    const chatId = row.id.slice("chat:".length)
    requestShellChat({ title: row.title, chatId })
  }

  function onQuery(value: string) {
    dispatch({ type: "query_typed", value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        instant
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden overscroll-contain rounded-none bg-background p-0 text-foreground ring-1 ring-border sm:top-[12vh] sm:left-1/2 sm:h-[min(32rem,70vh)] sm:max-w-2xl sm:-translate-x-1/2 sm:translate-y-0 sm:rounded-xl"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div
          data-slot="palette-search"
          className="flex items-center gap-3 border-b border-border px-4 py-3 has-[input:focus-visible]:border-b-2 has-[input:focus-visible]:border-ring"
        >
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
            placeholder="Search jobs, Paper, and chats…"
            aria-controls="palette-results"
            aria-activedescendant={
              active ? `palette-row-${active.id}` : undefined
            }
            className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-base shadow-none ring-0 outline-none focus-visible:border-0 focus-visible:ring-0 md:text-sm"
          />
          <Button
            className="size-11 md:size-auto md:p-0.5"
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close search"
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden="true" className="md:hidden" />
            <Kbd aria-hidden="true" className="max-md:hidden">
              Esc
            </Kbd>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
          {PALETTE_SCOPES.map((item) => (
            <Button
              className="h-11 md:h-7"
              key={item.id}
              type="button"
              size="sm"
              variant={scope === item.id ? "secondary" : "ghost"}
              aria-pressed={scope === item.id}
              onClick={() => dispatch({ type: "scope_chosen", scope: item.id })}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div
          ref={resultsRef}
          id="palette-results"
          aria-busy={waiting}
          className="min-h-0 flex-1 overflow-auto overscroll-contain px-2 py-2"
        >
          <p
            role="status"
            className={
              waiting ? "px-3 py-3 text-sm text-muted-foreground" : "sr-only"
            }
          >
            {waiting ? "Searching…" : ""}
          </p>
          {failed ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-3 px-3 py-6"
            >
              <p className="text-sm text-destructive">{copy.failed}</p>
              <Button
                type="button"
                variant="outline"
                className="h-11 md:h-7"
                onClick={() => dispatch({ type: "search_retried" })}
              >
                Retry
              </Button>
            </div>
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
                  const Icon = rowIcon(row)
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
                      onMouseEnter={() =>
                        dispatch({ type: "row_focused", id: row.id })
                      }
                      onClick={() => activate(row)}
                      className={cn(
                        "h-auto min-h-11 w-full justify-start gap-3 px-3 py-2 text-left whitespace-normal md:min-h-0",
                        current && "bg-muted"
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className="shrink-0 text-muted-foreground"
                      />
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
        {active && rowProperties(active) !== rowLabel(active) ? (
          <p
            data-slot="palette-properties"
            className="border-t border-border px-4 py-3 text-sm text-muted-foreground"
          >
            {rowProperties(active)}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
