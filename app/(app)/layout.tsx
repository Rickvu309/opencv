import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { AppSidebar } from "@/components/app-sidebar";
import { CoachDock } from "@/components/coach/coach-dock";
import { HelpButton } from "@/components/help-button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TooltipProvider>
      <AppShell>
        {/* Skip-nav link — the page's first focusable element. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:ring-3 focus:ring-ring/50"
        >
          Bỏ qua tới nội dung chính
        </a>
        <AppSidebar />
        {/* Content frame floating on the grey canvas, Linear-style; the bottom gutter holds the coach strip. */}
        <SidebarInset
          id="main-content"
          className="h-svh overflow-hidden md:h-[calc(100svh-3.5rem)] md:border md:peer-data-[variant=inset]:mb-12"
        >
          <AppHeader />
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          <CoachDock />
          <HelpButton />
        </SidebarInset>
        <Toaster position="top-center" />
      </AppShell>
    </TooltipProvider>
  );
}
