import { useEffect, useState } from "react"
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
      <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground">
        <Outlet />
      </div>
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

function AppShellChrome() {
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen((open) => !open)
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
      <AppShell onSearch={() => setSearchOpen(true)} />
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSurface={goSurface}
      />
    </>
  )
}
