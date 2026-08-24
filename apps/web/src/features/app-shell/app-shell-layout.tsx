import { Outlet } from "@tanstack/react-router"

import { AppSidebar } from "@/features/app-shell/app-sidebar.tsx"
import { ThreadStoreProvider } from "@/features/home/thread-store.tsx"

export function AppShellLayout() {
  return (
    <ThreadStoreProvider>
      <div className="flex h-svh overflow-hidden bg-background text-foreground">
        <AppSidebar />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </ThreadStoreProvider>
  )
}
