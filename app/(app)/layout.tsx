import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { AppSidebar } from "@/components/app-sidebar";
import { CoachDock } from "@/components/coach/coach-dock";
import { CoachProvider } from "@/components/coach/provider";
import { HelpButton } from "@/components/help-button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SkipLink } from "@/components/skip-link";
import { WaitlistPrompt } from "@/components/waitlist-prompt";
import { initialConversations } from "@/lib/coach/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The signed-in account's Coach threads, so a second device shows the same
  // conversations rather than an empty sidebar beside a full profile.
  const conversations = await initialConversations();

  return (
    <TooltipProvider>
      <AppShell>
<SkipLink />
        <CoachProvider initial={conversations}>
        <AppSidebar />
        {/* Content frame floating on the grey canvas, Linear-style; the bottom gutter holds the coach strip. */}
        <SidebarInset
          id="main-content"
          className="h-svh overflow-hidden md:h-[calc(100svh-3.5rem)] md:border md:peer-data-[variant=inset]:mb-12"
        >
          <AppHeader />
          {/* Here rather than on /profile, because onboarding now hands over to
              the Coach and the ask has to survive that. It shows itself only
              once, on the first screen after onboarding, whichever that is. */}
          <WaitlistPrompt />
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {/* Below md both controls form one real row at the foot of the frame,
              so the scroll area above ends where they begin. `md:contents`
              dissolves this wrapper from md, letting each float into the
              frame's bottom gutter as before. */}
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:contents">
            <HelpButton />
            <CoachDock />
          </div>
        </SidebarInset>
        </CoachProvider>
        <Toaster position="top-center" />
      </AppShell>
    </TooltipProvider>
  );
}
