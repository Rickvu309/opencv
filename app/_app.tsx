import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPaletteHost } from "@/components/command-palette-host";
import { CoachDock } from "@/components/coach/coach-dock";
import { CoachProvider } from "@/components/coach/provider";
import { HelpButton } from "@/components/help-button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SkipLink } from "@/components/skip-link";
import { loadConversations } from "@/lib/coach/hydrate";
import { queryKeys } from "@/lib/query/satellite";

export const Route = createFileRoute("/_app")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.conversations,
      queryFn: () => loadConversations(),
    }),
  component: AppLayout,
});

function AppLayout() {
  const conversations = Route.useLoaderData();

  return (
    <TooltipProvider>
      <AppShell>
        <SkipLink />
        <CoachProvider initial={conversations}>
          <AppSidebar />
          <SidebarInset
            id="main-content"
            className="h-svh overflow-hidden md:h-[calc(100svh-3.5rem)] md:border md:peer-data-[variant=inset]:mb-12"
          >
            <AppHeader />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Outlet />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:contents">
              <HelpButton />
              <CoachDock />
            </div>
          </SidebarInset>
        </CoachProvider>
        <CommandPaletteHost />
        <Toaster position="top-center" />
      </AppShell>
    </TooltipProvider>
  );
}
