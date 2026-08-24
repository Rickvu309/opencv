import { Link, Outlet } from "@tanstack/react-router"

import {
  SURFACE_PATHS,
  SURFACES,
  type SurfaceId,
} from "@/features/app-shell/surfaces.ts"

function surfaceLinkClassName({ isActive }: { isActive: boolean }) {
  return isActive
    ? "text-sm font-medium text-foreground"
    : "text-sm font-medium text-muted-foreground hover:text-foreground"
}

export function AppShellLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Temporary frame — QVE-91 replaces this with the real sidebar. */}
      <header className="border-b border-border px-4 py-3">
        <nav aria-label="Surfaces" className="flex flex-wrap gap-4">
          {SURFACES.map((surface) => (
            <SurfaceLink key={surface.id} surface={surface.id} />
          ))}
        </nav>
      </header>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

function SurfaceLink({ surface }: { surface: SurfaceId }) {
  const label = SURFACES.find((item) => item.id === surface)?.label ?? surface

  return (
    <Link
      to={SURFACE_PATHS[surface]}
      activeOptions={{ exact: true }}
      activeProps={{ className: surfaceLinkClassName({ isActive: true }) }}
      inactiveProps={{ className: surfaceLinkClassName({ isActive: false }) }}
    >
      {label}
    </Link>
  )
}
