"use client";

import type { ReactNode } from "react";

import { Sidebar } from "@/components/shell/sidebar";
import { CopilotPanel } from "@/components/shell/copilot-panel";
import { useStore } from "@/lib/store";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { state } = useStore();

  return (
    <div className="flex h-full w-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      {state.copilot.open ? <CopilotPanel /> : null}
    </div>
  );
}
