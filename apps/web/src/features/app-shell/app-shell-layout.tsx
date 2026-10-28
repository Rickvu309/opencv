import { useEffect, useState } from "react"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"

import { AppShell } from "@/features/app-shell/app-shell.tsx"
import { SearchModal } from "@/features/app-shell/search-modal.tsx"
import {
  HOME_PATH,
  SURFACE_PATHS,
  type SurfaceId,
} from "@/features/app-shell/surfaces.ts"
import { ShellOverlays } from "@/features/auth/shell-overlays.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { useChatList } from "@/features/coach/use-chat-list.ts"

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
  const { openChat } = useChatList()
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

  function handleOpenChat(id: string) {
    openChat(id)
    void navigate({ to: HOME_PATH })
  }

  function goSurface(id: SurfaceId) {
    void navigate({ to: SURFACE_PATHS[id] })
  }

  return (
    <>
      <AppShell onSearch={() => setSearchOpen(true)} />
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onOpenChat={handleOpenChat}
        onSurface={goSurface}
      />
    </>
  )
}
