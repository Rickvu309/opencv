"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/shell/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CopilotPanel } from "@/components/shell/copilot-panel";
import { DesktopGuard } from "@/components/shell/desktop-guard";
import { useStore } from "@/lib/store";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { state, toggleCopilot, setSidebarOpen } = useStore();

  // A quiet keyboard entry to the Copilot panel, available anywhere in the
  // app shell regardless of whether the panel is currently open. The
  // sidebar's own Cmd/Ctrl+B shortcut lives inside SidebarProvider.
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
        <AppSidebar />
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
