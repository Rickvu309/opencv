"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { RecruiterSidebar } from "@/components/shell/recruiter-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CopilotPanel } from "@/components/shell/copilot-panel";
import { DesktopGuard } from "@/components/shell/desktop-guard";
import { useStore } from "@/lib/store";

// Recruiter mode's own layout (RDS-988): the same shell primitives as
// app/(app)/layout.tsx (SidebarProvider/SidebarInset, the Copilot panel
// docking on the right), just with RecruiterSidebar in place of AppSidebar.
// A route group has no effect on the URL, so a direct visit to any
// /recruiter/* path always renders through this layout regardless of which
// mode was open last, satisfying "direct URLs work regardless of last mode"
// for free: there's no stored "current mode" to be stale.
export default function RecruiterLayout({ children }: { children: ReactNode }) {
  const { state, toggleCopilot, setSidebarOpen } = useStore();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleCopilot();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCopilot]);

  return (
    <DesktopGuard>
      <SidebarProvider open={state.sidebarOpen} onOpenChange={setSidebarOpen} className="h-full min-h-0">
        <RecruiterSidebar />
        <SidebarInset className="min-w-0">
          <div className="flex h-full min-w-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
            {state.copilot.open ? <CopilotPanel /> : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DesktopGuard>
  );
}
