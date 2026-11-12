import "./design/dock.pen.css"

import { useEffect, useReducer, useRef } from "react"
import { useShortcut } from "@/lib/use-shortcut.ts"
import { ignoreRejection } from "@/lib/quiet-rejection.ts"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { History, Menu, MessageCircle } from "lucide-react"

import { FocusSafeRegion } from "@/components/focus-safe-region.tsx"
import { AppSidebar } from "@/features/app-shell/app-sidebar.tsx"
import { SidebarFrame } from "@/features/app-shell/sidebar-frame.tsx"
import { useSidebarLayout } from "@/features/app-shell/use-sidebar-layout.ts"
import { chatDisplayTitle } from "@workspace/domain"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query.ts"
import { SidebarExpandContext } from "@/lib/sidebar-expand.tsx"
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

const COACH_PANEL_ID = "coach-panel"

type PanelState = {
  mounted: boolean
  open: boolean
  mode: Exclude<CoachPanelMode, "dock">
  title: string
  chatId: string | null
}

const NO_PANEL: PanelState = {
  mounted: false,
  open: false,
  mode: "side",
  title: "",
  chatId: null,
}

type ShellState = { panel: PanelState; drawerOpen: boolean }

type ShellAction =
  | { type: "panel_opened"; title: string; chatId: string | null }
  | { type: "panel_closed" }
  | { type: "panel_restored" }
  | { type: "panel_expanded" }
  | { type: "drawer_opened" }
  | { type: "drawer_closed" }

const SHELL_START: ShellState = { panel: NO_PANEL, drawerOpen: false }

function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case "panel_opened":
      return {
        ...state,
        panel: {
          mounted: true,
          open: true,
          mode: "side",
          title: action.title,
          chatId: action.chatId,
        },
      }
    case "panel_closed":
      return { ...state, panel: { ...state.panel, open: false } }
    case "panel_restored":
      return { ...state, panel: { ...state.panel, open: true } }
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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const coachPage = pathname === "/coach" || pathname.startsWith("/coach/")
  const wide = useMediaQuery("(min-width: 1280px)", true)
  const sheet = !isDesktop || !wide
  const layout = useSidebarLayout(isDesktop)
  const [{ panel, drawerOpen }, dispatch] = useReducer(
    shellReducer,
    SHELL_START
  )
  const panelOpen = panel.open && !coachPage
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
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!panelOpen) return
    const frame = document.getElementById(COACH_PANEL_ID)
    frame?.focus({ preventScroll: true })
    const animation = requestAnimationFrame(() => {
      if (!frame?.contains(document.activeElement))
        frame?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(animation)
  }, [panelOpen])

  useEffect(() => {
    const viewport = window.visualViewport
    const frame = document.getElementById(COACH_PANEL_ID)
    if (!sheet || !panelOpen || !viewport || !frame) return
    function resize() {
      frame?.style.setProperty("height", `${viewport?.height}px`)
      frame?.style.setProperty("top", `${viewport?.offsetTop}px`)
    }
    resize()
    viewport.addEventListener("resize", resize)
    viewport.addEventListener("scroll", resize)
    return () => {
      viewport.removeEventListener("resize", resize)
      viewport.removeEventListener("scroll", resize)
      frame.style.removeProperty("height")
      frame.style.removeProperty("top")
    }
  }, [sheet, panelOpen])

  useShortcut({
    key: "Escape",
    enabled: panelOpen,
    inFields: true,
    onPress: closePanel,
  })

  function focusCoachButton() {
    dockRef.current?.querySelector<HTMLElement>("[data-dock-coach]")?.focus()
  }

  function closePanel() {
    dispatch({ type: "panel_closed" })
    if (openerRef.current?.isConnected)
      openerRef.current.focus({ preventScroll: true })
    else focusCoachButton()
  }

  function rememberOpener() {
    if (
      !panelOpen &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
    ) {
      openerRef.current = document.activeElement
    }
  }

  function openPanel(next: { title: string; chatId: string | null }) {
    if (coachPage) {
      void navigate({
        to: "/coach",
        search: { chat: next.chatId ?? undefined },
      })
      return
    }
    rememberOpener()
    dispatch({ type: "panel_opened", title: next.title, chatId: next.chatId })
  }

  useEffect(() => {
    openPanelRef.current = openPanel
  })

  function toggleCoach() {
    if (panel.open) {
      closePanel()
      return
    }
    rememberOpener()
    if (panel.mounted) {
      dispatch({ type: "panel_restored" })
      return
    }
    openPanel({ title: shellCopy.coach, chatId: null })
  }

  async function onNewChat() {
    rememberOpener()
    const chat = await ignoreRejection(
      runContractCommand(queryClient, "chat.create", {}),
      "failedCreateLeavesPanelClosed"
    )
    if (!chat) return
    openPanel({
      title: chatDisplayTitle(chat.title),
      chatId: chat.id,
    })
  }

  function closeDrawer() {
    dispatch({ type: "drawer_closed" })
    menuRef.current?.focus()
  }

  const panelFrame = (
    <FocusSafeRegion
      id={COACH_PANEL_ID}
      data-slot="shell-coach"
      data-pen-surface="app-shell"
      data-open={panelOpen}
      data-full={panel.mode === "full"}
      role={sheet ? "dialog" : undefined}
      aria-modal={sheet && panelOpen ? true : undefined}
      aria-label={sheet ? "Coach" : undefined}
      aria-hidden={!panelOpen}
      concealed={!panelOpen}
      focusFallback={() =>
        openerRef.current ??
        dockRef.current?.querySelector<HTMLElement>("[data-dock-coach]") ??
        null
      }
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || (!sheet && panel.mode !== "full")) return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
        )
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === event.currentTarget)
        ) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
    >
      {panel.mounted ? (
        <CoachPanel
          title={panel.title}
          open
          mode={panel.mode}
          onMinimize={closePanel}
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
    </FocusSafeRegion>
  )

  const collapsedRail = isDesktop && layout.collapsed
  const sidebarExpand = {
    collapsed: collapsedRail,
    expand: layout.expand,
  }

  const nav = (
    <AppSidebar
      onMenuOpenChange={isDesktop ? layout.menuOpenChange : undefined}
      onNavigate={() => {
        if (isDesktop) layout.peekClose()
        else closeDrawer()
      }}
      onSearch={() => {
        if (isDesktop) layout.peekClose()
        else closeDrawer()
        onSearch()
      }}
      onNewChat={() => {
        if (isDesktop) layout.peekClose()
        else closeDrawer()
        void onNewChat()
      }}
    />
  )

  return (
    <div
      data-slot="app-shell"
      onClickCapture={(event) => {
        if (panelOpen || !(event.target instanceof Element)) return
        const opener = event.target.closest<HTMLElement>("button, a")
        if (opener) openerRef.current = opener
      }}
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
        {isDesktop ? <SidebarFrame layout={layout}>{nav}</SidebarFrame> : null}
        <div
          data-slot="shell-main"
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-sidebar transition-[padding] duration-(--duration-panel) ease-(--ease-panel) motion-reduce:transition-none md:pt-2 md:pr-2",
            collapsedRail && "md:pl-2",
            "peer-data-[collapse-preview=true]/frame:md:pl-2"
          )}
        >
          <div
            data-slot="shell-workspace"
            data-pen-surface="app-shell"
            data-coach-open={panelOpen}
            data-coach-full={panel.mode === "full"}
            className="relative min-h-0 min-w-0 flex-1 bg-background md:rounded-[8px] md:border-[0.5px] md:border-border"
          >
            <SidebarExpandContext value={sidebarExpand}>
              <FocusSafeRegion
                data-slot="workspace-main"
                concealed={panelOpen && (sheet || panel.mode === "full")}
                focusFallback={() => document.getElementById(COACH_PANEL_ID)}
                hidden={panelOpen && panel.mode === "full"}
                className="min-h-0 min-w-0 overflow-hidden rounded-[inherit]"
              >
                <main
                  id="app-main"
                  tabIndex={-1}
                  className="h-full min-h-0 min-w-0 overflow-hidden rounded-[inherit] outline-none"
                >
                  <Outlet />
                </main>
              </FocusSafeRegion>
            </SidebarExpandContext>
            {panelFrame}
          </div>
          {coachPage ? null : (
            <ShellDock
              dockRef={dockRef}
              coachOpen={panelOpen}
              onCoach={toggleCoach}
              onHistory={() => {
                closePanel()
                void navigate({ to: "/coach" })
              }}
            />
          )}
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
  coachOpen,
  onCoach,
  onHistory,
}: {
  dockRef: { current: HTMLDivElement | null }
  coachOpen: boolean
  onCoach: () => void
  onHistory: () => void
}) {
  return (
    <div
      ref={dockRef}
      data-slot="app-dock"
      data-pen-surface="app-shell"
      className="flex h-12 shrink-0 items-center justify-end md:h-10"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 aria-expanded:bg-sidebar-accent md:h-7"
        data-dock-coach=""
        aria-expanded={coachOpen}
        aria-controls={COACH_PANEL_ID}
        onClick={onCoach}
      >
        <MessageCircle aria-hidden="true" />
        {shellCopy.coach}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-11 md:size-7"
        aria-label={shellCopy.history}
        onClick={onHistory}
      >
        <History aria-hidden="true" />
      </Button>
    </div>
  )
}
