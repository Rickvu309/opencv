import { useEffect, useState } from "react"
import { Outlet, useNavigate } from "@tanstack/react-router"

import { AppSidebar } from "@/features/app-shell/app-sidebar.tsx"
import { FOCUS_RING } from "@/features/app-shell/focus-ring.ts"
import {
  SearchModal,
  searchThreadsFromHome,
} from "@/features/app-shell/search-modal.tsx"
import { SURFACE_PATHS, type SurfaceId } from "@/features/app-shell/surfaces.ts"
import { useMediaQuery } from "@/features/app-shell/use-media-query.ts"
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
  const isDesktop = useMediaQuery("(min-width: 768px)", true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(isDesktop)
  }, [isDesktop])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function closeSidebarIfNarrow() {
    if (!isDesktop) setSidebarOpen(false)
  }

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
      <a
        href="#app-main"
        className={`${FOCUS_RING} sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3`}
      >
        Skip to main content
      </a>
      {!isDesktop && sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <AppSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onSearch={() => {
          setSearchOpen(true)
          closeSidebarIfNarrow()
        }}
        onNavigate={closeSidebarIfNarrow}
      />
      <main
        id="app-main"
        tabIndex={-1}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-md:pl-14"
      >
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
