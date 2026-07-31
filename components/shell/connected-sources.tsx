"use client";

import Link from "next/link";
import { PlugZap } from "lucide-react";

import { freshnessLabel } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";

/**
 * The quiet sidebar shortcut into /sources: a compact status line (how many
 * sources are connected and the freshest sync) that links straight to the
 * full tools hub and synced-context inbox, rather than opening its own
 * dialog. Simulated only, nothing here reaches a real inbox.
 */
export function ConnectedSourcesButton() {
  const { state } = useStore();
  const connected = state.connectedSources.filter((source) => source.status === "connected");
  const freshest = connected[0];

  return (
    <Link
      href="/sources"
      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
    >
      <PlugZap className="size-4 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium">
          {connected.length} {connected.length === 1 ? "source" : "sources"} connected
        </span>
        {freshest ? (
          <span className="text-xs text-sidebar-foreground/50">
            {freshest.name} synced {freshnessLabel(freshest.lastSyncedMinutesAgo ?? 0)}
          </span>
        ) : (
          <span className="text-xs text-sidebar-foreground/50">Connect a tool to get started</span>
        )}
      </span>
    </Link>
  );
}
