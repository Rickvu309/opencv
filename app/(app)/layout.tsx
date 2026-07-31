"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/shell/sidebar";
import { CopilotPanel } from "@/components/shell/copilot-panel";
import { WeeklyReviewDialog } from "@/components/shell/weekly-review-dialog";
import { useStore } from "@/lib/store";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { state, toggleCopilot } = useStore();

  // A quiet keyboard entry to the Copilot panel, available anywhere in the
  // app shell regardless of whether the panel is currently open.
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
    <div className="flex h-full w-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      {state.copilot.open ? <CopilotPanel /> : null}
      <WeeklyReviewDialog />
    </div>
  );
}
