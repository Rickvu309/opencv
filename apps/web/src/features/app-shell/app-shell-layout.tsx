import { Outlet } from "@tanstack/react-router"

import { AppSidebar } from "@/features/app-shell/app-sidebar.tsx"

export function AppShellLayout() {
  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
