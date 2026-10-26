import { useEffect, useState } from "react"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"

import { AppShell } from "@/features/app-shell/app-shell.tsx"
import { SearchModal } from "@/features/app-shell/search-modal.tsx"
import { searchThreadsFromList } from "@/features/app-shell/search-threads.ts"
import {
  HOME_PATH,
  SURFACE_PATHS,
  type SurfaceId,
} from "@/features/app-shell/surfaces.ts"
import { ShellOverlays } from "@/features/auth/shell-overlays.tsx"
import { ThreadStoreProvider } from "@/features/home/thread-store.tsx"
import { useThreadList } from "@/features/home/use-thread-list.ts"

export function AppShellLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  if (pathname.startsWith("/app/settings")) {
    return (
      <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground">
        <Outlet />
      </div>
    )
  }
  return (
    <ThreadStoreProvider>
      <ShellOverlays>
        <AppShellChrome />
      </ShellOverlays>
    </ThreadStoreProvider>
  )
}

function AppShellChrome() {
  const navigate = useNavigate()
  const { threads, newThread, openThread } = useThreadList()
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

  function handleNewThread() {
    newThread()
    void navigate({ to: HOME_PATH })
  }

  function handleOpenThread(id: string) {
    openThread(id)
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
        threads={searchThreadsFromList(threads)}
        onNewThread={handleNewThread}
        onOpenThread={handleOpenThread}
        onSurface={goSurface}
      />
    </>
  )
}
