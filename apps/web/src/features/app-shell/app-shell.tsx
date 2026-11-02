import "./design/dock.pen.css"

import { useEffect, useReducer, useRef } from "react"
import { Outlet, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { History, Menu, MessageCircle } from "lucide-react"

import { AppSidebar } from "@/features/app-shell/app-sidebar.tsx"
import { chatDisplayTitle } from "@workspace/domain"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query.ts"
import { useShellChats } from "@/features/app-shell/use-shell-chats.ts"
import {
  CoachPanel,
  type CoachPanelMode,
} from "@/features/coach/coach-panel.tsx"
import { CoachWorkspace } from "@/features/coach/coach-workspace.tsx"
import { registerShellChatOpener } from "@/features/command-palette/shell-chat.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { Mark } from "@workspace/ui/components/brand"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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

type ShellState = { panel: PanelState; drawerOpen: boolean }

type ShellAction =
  | { type: "panel_opened"; title: string; chatId: string | null }
  | { type: "panel_closed" }
  | { type: "panel_minimized" }
  | { type: "panel_expanded" }
  | { type: "drawer_opened" }
  | { type: "drawer_closed" }

const SHELL_START: ShellState = { panel: CLOSED_PANEL, drawerOpen: false }

function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case "panel_opened":
      return {
        ...state,
        panel: {
          open: true,
          mode: "side",
          title: action.title,
          chatId: action.chatId,
        },
      }
    case "panel_closed":
      return { ...state, panel: CLOSED_PANEL }
    case "panel_minimized":
      return { ...state, panel: { ...state.panel, mode: "dock" } }
    case "panel_expanded":
      return {
        ...state,
        panel: {
          ...state.panel,
          mode: state.panel.mode === "full" ? "side" : "full",
        },
      }
    case "drawer_opened":
      return { ...state, drawerOpen: true }
    case "drawer_closed":
      return { ...state, drawerOpen: false }
  }
}

type AppShellProps = {
  onSearch: () => void
}

export function AppShell({ onSearch }: AppShellProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  const chats = useShellChats()
  const [{ panel, drawerOpen }, dispatch] = useReducer(
    shellReducer,
    SHELL_START
  )
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
      dispatch({ type: "panel_closed" })
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
    dispatch({ type: "panel_opened", title: next.title, chatId: next.chatId })
  }

  useEffect(() => {
    openPanelRef.current = openPanel
  })

  function closePanel() {
    dispatch({ type: "panel_closed" })
    openerRef.current?.focus()
  }

  async function onNewChat() {
    rememberOpener()
    try {
      const chat = await runContractCommand(queryClient, "chat.create", {})
      dispatch({
        type: "panel_opened",
        title: chatDisplayTitle(chat.title),
        chatId: chat.id,
      })
    } catch {
      // rejected-ok: a failed create leaves the panel closed. The page stays usable.
    }
  }

  function closeDrawer() {
    dispatch({ type: "drawer_closed" })
    menuRef.current?.focus()
  }

  const panelFrame = (
    <div
      hidden={!panelVisible}
      className={cn(
        "z-10 min-h-0 bg-background",
        panelVisible && "flex flex-col",
        panel.mode === "full" && "absolute inset-0",
        panel.mode === "side" &&
          "inset-e-2 inset-be-2 absolute h-[min(600px,calc(100%_-_16px))] w-[400px] max-w-[calc(100%_-_16px)]"
      )}
    >
      {panel.open ? (
        <CoachPanel
          title={panel.title}
          open
          mode={panel.mode === "dock" ? "side" : panel.mode}
          onMinimize={() => dispatch({ type: "panel_minimized" })}
          onExpand={() => dispatch({ type: "panel_expanded" })}
          onClose={closePanel}
        >
          {(controls) => (
            <CoachWorkspace
              chatId={panel.chatId}
              presentation="compact"
              headerActions={controls}
            />
          )}
        </CoachPanel>
      ) : null}
    </div>
  )

  const nav = (
    <AppSidebar
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
            className="size-11"
            aria-label={shellCopy.menu}
            onClick={() => dispatch({ type: "drawer_opened" })}
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
          <div className="relative flex min-h-0 min-w-0 flex-1 bg-background md:rounded-[8px] md:border-[0.5px] md:border-border">
            <main
              id="app-main"
              tabIndex={-1}
              hidden={panel.open && panel.mode === "full"}
              className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]"
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
            <div className="absolute top-2 -right-11 z-10">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="size-11"
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
      data-pen-surface="app-shell"
      className="flex h-10 shrink-0 items-center justify-end"
    >
      <div data-slot="dock-recent" className="flex min-w-0 overflow-x-auto">
        {titles.map((chat) => (
          <Button
            key={chat.id}
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-36 shrink-0"
            data-chat-id={chat.id}
            title={chat.title}
            onClick={() => onOpenChat({ title: chat.title, chatId: chat.id })}
          >
            <span className="truncate">{chat.title}</span>
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-dock-coach=""
        onClick={onCoach}
      >
        <MessageCircle aria-hidden="true" />
        {shellCopy.coach}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={shellCopy.history}
        onClick={onHistory}
      >
        <History aria-hidden="true" />
      </Button>
    </div>
  )
}
