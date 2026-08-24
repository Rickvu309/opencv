import { useEffect, useState } from "react"
import { Outlet, useNavigate } from "@tanstack/react-router"

import { AppSidebar } from "@/features/app-shell/app-sidebar.tsx"
import {
  SearchModal,
  searchThreadsFromHome,
} from "@/features/app-shell/search-modal.tsx"
import { SURFACE_PATHS, type SurfaceId } from "@/features/app-shell/surfaces.ts"
import { ThreadStoreProvider } from "@/features/home/thread-store.tsx"
import { useThreadStore } from "@/features/home/use-thread-store.ts"

export function AppShellLayout() {
  return (
    <ThreadStoreProvider>
      <AppShellChrome />
    </ThreadStoreProvider>
  )
}

function AppShellChrome() {
  const navigate = useNavigate()
  const { threads, newChat, openThread } = useThreadStore()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function handleNewChat() {
    newChat()
    void navigate({ to: SURFACE_PATHS.home })
  }

  function handleOpenThread(id: string) {
    openThread(id)
    void navigate({ to: SURFACE_PATHS.home })
  }

  function goSurface(id: SurfaceId) {
    void navigate({ to: SURFACE_PATHS[id] })
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <AppSidebar onSearch={() => setSearchOpen(true)} />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        threads={searchThreadsFromHome(threads)}
        onNewChat={handleNewChat}
        onOpenThread={handleOpenThread}
        onSurface={goSurface}
      />
    </div>
  )
}
