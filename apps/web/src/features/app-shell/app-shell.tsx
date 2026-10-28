import { useEffect, useRef, useState } from "react"
import { Link, Outlet, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import {
  BriefcaseBusiness,
  Columns3,
  FileText,
  Inbox,
  Link2,
  Menu,
  MessageCircle,
  Search,
  SquarePen,
} from "lucide-react"

import { NavProfile } from "@/features/app-shell/nav-profile.tsx"
import { searchShortcutLabel } from "@/features/app-shell/search-shortcut.ts"
import { SHELL_PRIMARY, SHELL_WORK } from "@/features/app-shell/sidebar-nav.ts"
import { chatDisplayTitle } from "@workspace/domain"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import {
  DESKTOP_MEDIA_QUERY,
  useMediaQuery,
} from "@/features/app-shell/use-media-query.ts"
import {
  useInboxUnread,
  useShellChats,
  useShellFavorites,
} from "@/features/app-shell/use-shell-chats.ts"
import {
  CoachPanel,
  type CoachPanelMode,
} from "@/features/app-shell/coach-panel.tsx"
import { ShellChatBody } from "@/features/app-shell/shell-chat-body.tsx"
import { registerShellChatOpener } from "@/features/command-palette/shell-chat.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { Brand, Mark } from "@workspace/ui/components/brand"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

type PanelState = {
  open: boolean
  mode: CoachPanelMode
  title: string
  chatId: string | null
}

const CLOSED_PANEL: PanelState = {
  open: false,
  mode: "dock",
  title: "",
  chatId: null,
}

type ShellNavProps = {
  onNavigate?: () => void
  onSearch: () => void
  onNewChat: () => void
}

function linkClass(active: boolean) {
  return cn(
    FOCUS_RING,
    "flex h-7 items-center gap-2 rounded-md px-2 text-sm text-foreground hover:bg-muted",
    active && "bg-muted"
  )
}

const navigationIcons = {
  inbox: Inbox,
  coach: MessageCircle,
  jobs: BriefcaseBusiness,
  paper: FileText,
  apply: Columns3,
  pitch: Link2,
}

function ShellNav({ onNavigate, onSearch, onNewChat }: ShellNavProps) {
  const inbox = useInboxUnread()
  const favorites = useShellFavorites()
  const count = inbox.data ?? null
  const favoriteEmpty =
    favorites.jobs.length === 0 && favorites.docs.length === 0

  return (
    <div className="flex h-full min-h-0 w-[244px] flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <Brand size={16} />
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={shellCopy.search}
            aria-keyshortcuts="Control+K Meta+K"
            onClick={onSearch}
          >
            <Search />
            <Kbd className="sr-only">{searchShortcutLabel()}</Kbd>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={shellCopy.newChat}
            onClick={onNewChat}
          >
            <SquarePen />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <nav aria-label="Main" className="mt-2 flex flex-col gap-0.5">
          {SHELL_PRIMARY.map((item) => {
            const Icon = navigationIcons[item.id]
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-label={item.label}
                activeOptions={{ exact: true }}
                onClick={onNavigate}
                activeProps={{ className: linkClass(true) }}
                inactiveProps={{ className: linkClass(false) }}
              >
                <Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                {item.id === "inbox" && count != null ? (
                  <span
                    aria-hidden="true"
                    className="ml-auto text-xs text-muted-foreground"
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            )
          })}
          <p className="px-2 pt-3 pb-1 text-xs text-muted-foreground">
            {shellCopy.yourWork}
          </p>
          {SHELL_WORK.map((item) => {
            const Icon = navigationIcons[item.id]
            return (
              <Link
                key={item.id}
                to={item.to}
                activeOptions={{ exact: true }}
                onClick={onNavigate}
                activeProps={{ className: linkClass(true) }}
                inactiveProps={{ className: linkClass(false) }}
              >
                <Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
        {favorites.pending ? (
          <Skeleton className="mx-2 mt-3 h-7" />
        ) : favoriteEmpty ? null : (
          <div className="mt-3 flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-xs text-muted-foreground">
              {shellCopy.favorites}
            </p>
            {favorites.jobs.map((job) => (
              <Link
                key={job.id || job.title}
                to="/apply"
                aria-label={
                  job.company ? `${job.title} ${job.company}` : job.title
                }
                onClick={onNavigate}
                className={linkClass(false)}
              >
                <span className="truncate">{job.title}</span>
                {job.company ? (
                  <span className="truncate text-muted-foreground">
                    {job.company}
                  </span>
                ) : null}
              </Link>
            ))}
            {favorites.docs.map((doc) => (
              <Link
                key={doc.id || doc.name}
                to="/paper"
                onClick={onNavigate}
                className={linkClass(false)}
              >
                <span className="truncate">{doc.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <NavProfile onNavigate={onNavigate} />
    </div>
  )
}

type AppShellProps = {
  onSearch: () => void
}

export function AppShell({ onSearch }: AppShellProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  const chats = useShellChats()
  const [panel, setPanel] = useState<PanelState>(CLOSED_PANEL)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)
  const openPanelRef = useRef<
    (next: { title: string; chatId: string | null }) => void
  >(() => {})

  useEffect(() => {
    registerShellChatOpener((next) => {
      openPanelRef.current({ title: next.title, chatId: next.chatId })
    })
    return () => registerShellChatOpener(null)
  }, [])
  const menuRef = useRef<HTMLButtonElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const panelVisible = panel.open && panel.mode !== "dock"

  useEffect(() => {
    if (!panel.open || panel.mode === "dock") return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      setPanel(CLOSED_PANEL)
      openerRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [panel.mode, panel.open])

  useEffect(() => {
    if (!panel.open || panel.mode !== "dock") return
    const root = dockRef.current
    if (!root) {
      openerRef.current?.focus()
      return
    }
    const chip = panel.chatId
      ? root.querySelector<HTMLElement>(`[data-chat-id="${panel.chatId}"]`)
      : null
    const coach = root.querySelector<HTMLElement>("[data-dock-coach]")
    ;(chip ?? coach)?.focus()
  }, [panel.chatId, panel.mode, panel.open])

  function rememberOpener() {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  }

  function openPanel(next: { title: string; chatId: string | null }) {
    rememberOpener()
    setPanel({
      open: true,
      mode: "side",
      title: next.title,
      chatId: next.chatId,
    })
  }

  useEffect(() => {
    openPanelRef.current = openPanel
  })

  function closePanel() {
    setPanel(CLOSED_PANEL)
    openerRef.current?.focus()
  }

  async function onNewChat() {
    rememberOpener()
    try {
      const chat = await runContractCommand(queryClient, "chat.create", {})
      setPanel({
        open: true,
        mode: "side",
        title: chatDisplayTitle(chat.title),
        chatId: chat.id,
      })
    } catch {
      // A failed create leaves the panel closed. The page stays usable.
    }
  }

  function closeDrawer() {
    setDrawerOpen(false)
    menuRef.current?.focus()
  }

  const panelFrame = (
    <div
      hidden={!panelVisible}
      className={cn(
        "min-h-0 bg-background",
        panelVisible && "flex flex-col",
        panel.mode === "full" && "absolute inset-0",
        panel.mode === "side" &&
          "h-full w-96 max-w-full shrink-0 border-l border-border"
      )}
    >
      {panel.open ? (
        <CoachPanel
          title={panel.title}
          open
          mode={panel.mode === "dock" ? "side" : panel.mode}
          onMinimize={() =>
            setPanel((current) => ({ ...current, mode: "dock" }))
          }
          onExpand={() =>
            setPanel((current) => ({
              ...current,
              mode: current.mode === "full" ? "side" : "full",
            }))
          }
          onClose={closePanel}
        >
          <ShellChatBody chatId={panel.chatId} />
        </CoachPanel>
      ) : null}
    </div>
  )

  const nav = (
    <ShellNav
      onNavigate={() => {
        if (!isDesktop) closeDrawer()
      }}
      onSearch={() => {
        if (!isDesktop) closeDrawer()
        onSearch()
      }}
      onNewChat={() => {
        if (!isDesktop) closeDrawer()
        void onNewChat()
      }}
    />
  )

  return (
    <div
      data-slot="app-shell"
      className="flex h-svh min-w-0 flex-col overflow-hidden bg-background text-foreground"
    >
      <a
        href="#app-main"
        className={`${FOCUS_RING} sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3`}
      >
        Skip to main content
      </a>
      {isDesktop ? null : (
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2">
          <Button
            ref={menuRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={shellCopy.menu}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu />
          </Button>
          <Mark size={16} />
          <span className="text-sm font-semibold">{shellCopy.wordmark}</span>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1">
        {isDesktop ? (
          <aside
            aria-label="Sidebar"
            className="flex w-[244px] shrink-0 bg-sidebar"
          >
            {nav}
          </aside>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-sidebar md:pt-2 md:pr-2">
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background md:rounded-lg md:border md:border-border">
            <main
              id="app-main"
              tabIndex={-1}
              hidden={panel.open && panel.mode === "full"}
              className="min-h-0 min-w-0 flex-1 overflow-hidden"
            >
              <Outlet />
            </main>
            {panelFrame}
          </div>
          <ShellDock
            dockRef={dockRef}
            titles={(chats.data ?? []).map((chat) => ({
              id: chat.id,
              title: chatDisplayTitle(chat.title),
            }))}
            onOpenChat={(chat) => openPanel(chat)}
            onCoach={() => openPanel({ title: shellCopy.coach, chatId: null })}
            onHistory={() => {
              closePanel()
              void navigate({ to: "/coach" })
            }}
          />
        </div>
      </div>
      {!isDesktop && drawerOpen ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeDrawer()
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="top-0 left-0 h-svh w-[244px] max-w-[80vw] translate-x-0 translate-y-0 rounded-none p-0 duration-(--duration-panel) ease-(--ease-panel)"
          >
            <DialogTitle className="sr-only">{shellCopy.menu}</DialogTitle>
            <div className="absolute top-2 right-2 z-10">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={shellCopy.closeMenu}
                onClick={closeDrawer}
              >
                <Menu />
              </Button>
            </div>
            {nav}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

function ShellDock({
  dockRef,
  titles,
  onOpenChat,
  onCoach,
  onHistory,
}: {
  dockRef: { current: HTMLDivElement | null }
  titles: { id: string; title: string }[]
  onOpenChat: (chat: { title: string; chatId: string }) => void
  onCoach: () => void
  onHistory: () => void
}) {
  return (
    <div
      ref={dockRef}
      data-slot="app-dock"
      className="flex h-10 shrink-0 items-center justify-end gap-1 border-t border-border px-2"
    >
      {titles.map((chat) => (
        <Button
          key={chat.id}
          type="button"
          variant="ghost"
          size="sm"
          className="max-w-36"
          data-chat-id={chat.id}
          onClick={() => onOpenChat({ title: chat.title, chatId: chat.id })}
        >
          <span className="truncate">{chat.title}</span>
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-dock-coach=""
        onClick={onCoach}
      >
        {shellCopy.coach}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onHistory}>
        {shellCopy.history}
      </Button>
    </div>
  )
}
