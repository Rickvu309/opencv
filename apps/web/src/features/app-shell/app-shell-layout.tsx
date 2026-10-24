import { useEffect, useState } from "react"
import { Outlet, useNavigate } from "@tanstack/react-router"

import { AppSidebar } from "@/features/app-shell/app-sidebar.tsx"
import { Button } from "@workspace/ui/components/button"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { SearchModal } from "@/features/app-shell/search-modal.tsx"
import { searchThreadsFromList } from "@/features/app-shell/search-threads.ts"
import { SURFACE_PATHS, type SurfaceId } from "@/features/app-shell/surfaces.ts"
import {
  DESKTOP_MEDIA_QUERY,
  useMediaQuery,
} from "@/features/app-shell/use-media-query.ts"
import { ThreadStoreProvider } from "@/features/home/thread-store.tsx"
import { useThreadList } from "@/features/home/use-thread-list.ts"

export function AppShellLayout() {
  return (
    <ThreadStoreProvider>
      <AppShellChrome />
    </ThreadStoreProvider>
  )
}

function AppShellChrome() {
  const navigate = useNavigate()
  const { threads, newThread, openThread } = useThreadList()
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  const [sidebar, setSidebar] = useState({
    alignedTo: isDesktop,
    open: isDesktop,
  })
  const [searchOpen, setSearchOpen] = useState(false)

  if (sidebar.alignedTo !== isDesktop) {
    setSidebar({ alignedTo: isDesktop, open: isDesktop })
  }

  const sidebarOpen = sidebar.open
  function setSidebarOpen(open: boolean) {
    setSidebar((current) => ({ ...current, open }))
  }

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

  function handleNewThread() {
    newThread()
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
        <Button
          type="button"
          variant="ghost"
          className="fixed inset-0 z-30 size-auto rounded-none bg-black/30 hover:bg-black/30 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <AppSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onNavigate={closeSidebarIfNarrow}
        onSearch={() => setSearchOpen(true)}
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
        threads={searchThreadsFromList(threads)}
        onNewThread={handleNewThread}
        onOpenThread={handleOpenThread}
        onSurface={goSurface}
      />
    </div>
  )
}
