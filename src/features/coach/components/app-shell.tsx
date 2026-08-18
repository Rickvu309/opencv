import { Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { CoachSessionProvider } from "@/features/coach/components/session";
import { Rail } from "@/features/coach/components/rail";
import { CoachDock } from "@/features/coach/components/dock";
import { NotificationBell } from "@/ui/notifications";
import { Menu } from "lucide-react";
import { Button } from "@/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";

function SignedInChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showDock = pathname !== "/coach";

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside
        data-print-hide
        className="sticky top-0 hidden h-svh w-[var(--size-rail)] shrink-0 overflow-hidden border-r border-hairline print:hidden md:flex md:flex-col"
      >
        <Rail />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-print-hide
          className="flex items-center gap-3 px-4 py-2 print:hidden"
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
                Conversations, Prepare, and Opportunities.
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
          className="flex-1 rounded-tl-[var(--radius-container)] border-t border-l border-hairline bg-surface-1 p-6"
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
