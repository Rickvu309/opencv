import { Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { CoachSessionProvider } from "@/features/coach/components/session";
import { Rail } from "@/features/coach/components/rail";
import {
  RailResize,
  useRailWidth,
  useRailCollapsed,
  RAIL_COLLAPSED_WIDTH,
} from "@/features/coach/components/rail-resize";
import { CoachDock } from "@/features/coach/components/dock";
import { NotificationBell } from "@/ui/notifications";
import { Menu } from "lucide-react";
import { Button } from "@/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";

function SignedInChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { width: railWidth, setWidth: setRailWidth, commit: commitRailWidth } = useRailWidth();
  const { collapsed, toggle } = useRailCollapsed();
  const showDock = pathname !== "/coach";
  const isCoach = pathname === "/coach";
  const frameWidth = collapsed ? RAIL_COLLAPSED_WIDTH : railWidth;

  return (
    <div className="flex h-svh overflow-hidden bg-canvas">
      <div
        data-print-hide
        data-rail-frame
        className="relative z-[var(--z-sticky)] hidden h-svh shrink-0 print:hidden md:block"
        style={{ width: frameWidth }}
      >
        <aside className="flex h-full flex-col overflow-hidden">
          <Rail collapsed={collapsed} onToggle={toggle} />
        </aside>
        {collapsed ? (
          <span aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-hairline" />
        ) : (
          <RailResize width={railWidth} onLive={setRailWidth} onCommit={commitRailWidth} />
        )}
      </div>
      <div
        className={
          isCoach
            ? "flex min-h-0 min-w-0 flex-1 flex-col"
            : "flex min-h-0 min-w-0 flex-1 flex-col p-2"
        }
      >
        <header
          data-print-hide
          className="flex h-10 shrink-0 items-center gap-3 px-2 print:hidden"
        >
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Button
              type="button"
              variant="ghost"
              className="size-11 px-0 md:hidden"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="size-4" aria-hidden="true" />
            </Button>
            <SheetContent side="left" className="p-0 md:hidden">
              <SheetTitle className="sr-only">Places</SheetTitle>
              <SheetDescription className="sr-only">
                Coach, History, Prepare, and Opportunities.
              </SheetDescription>
              <Rail onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
        <main
          id="main"
          className={
            isCoach
              ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas px-4 pb-6"
              : "min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-container)] border border-hairline bg-surface-1 px-5 py-4"
          }
        >
          <Outlet />
        </main>
      </div>
      {showDock ? <CoachDock /> : null}
    </div>
  );
}

export function AppShell() {
  return (
    <CoachSessionProvider>
      <SignedInChrome />
    </CoachSessionProvider>
  );
}
