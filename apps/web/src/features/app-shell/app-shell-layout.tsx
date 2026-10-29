import { useEffect, useReducer } from "react"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"

import { AppShell } from "@/features/app-shell/app-shell.tsx"
import { SURFACE_PATHS, type SurfaceId } from "@/lib/product-paths.ts"
import { ShellOverlays } from "@/features/auth/shell-overlays.tsx"
import { CommandPalette } from "@/features/command-palette/command-palette.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"

export function AppShellLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return (
      <ChatStoreProvider>
        <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground">
          <Outlet />
        </div>
      </ChatStoreProvider>
    )
  }
  return (
    <ChatStoreProvider>
      <ShellOverlays>
        <AppShellChrome />
      </ShellOverlays>
    </ChatStoreProvider>
  )
}

type SearchAction =
  | { type: "shortcut_pressed" }
  | { type: "search_requested" }
  | { type: "palette_closed" }

function searchReducer(open: boolean, action: SearchAction) {
  if (action.type === "shortcut_pressed") return !open
  return action.type === "search_requested"
}

function AppShellChrome() {
  const navigate = useNavigate()
  const [searchOpen, dispatchSearch] = useReducer(searchReducer, false)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        dispatchSearch({ type: "shortcut_pressed" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function goSurface(id: SurfaceId) {
    void navigate({ to: SURFACE_PATHS[id] })
  }

  return (
    <>
      <AppShell onSearch={() => dispatchSearch({ type: "search_requested" })} />
      <CommandPalette
        open={searchOpen}
        onOpenChange={(open) =>
          dispatchSearch({ type: open ? "search_requested" : "palette_closed" })
        }
        onSurface={goSurface}
      />
    </>
  )
}
