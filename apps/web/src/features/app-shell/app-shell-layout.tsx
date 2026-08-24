import { useEffect, useState } from "react"
import { Outlet, useNavigate } from "@tanstack/react-router"

import { AppSidebar } from "@/features/app-shell/app-sidebar.tsx"
import { SearchModal } from "@/features/app-shell/search-modal.tsx"
import { SEED_THREADS } from "@/features/app-shell/seed-threads.ts"
import { SURFACE_PATHS, type SurfaceId } from "@/features/app-shell/surfaces.ts"

export function AppShellLayout() {
  const navigate = useNavigate()
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

  function goHome() {
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
        threads={SEED_THREADS}
        onNewChat={goHome}
        onOpenThread={goHome}
        onSurface={goSurface}
      />
    </div>
  )
}
