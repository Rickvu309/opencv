"use client";

import Link from "next/link";
import { PlugZap } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { freshnessLabel } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";

/**
 * The quiet sidebar shortcut into /sources: a compact status line (how many
 * sources are connected and the freshest sync) that links straight to the
 * full tools hub and synced-context inbox, rather than opening its own
 * dialog. Simulated only, nothing here reaches a real inbox. Built on
 * SidebarMenuButton so it collapses to an icon with a tooltip like every
 * other sidebar row.
 */
export function ConnectedSourcesButton() {
  const { state } = useStore();
  const connected = state.connectedSources.filter((source) => source.status === "connected");
  const freshest = connected[0];
  const statusLabel = `${connected.length} ${connected.length === 1 ? "source" : "sources"} connected`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild size="lg" tooltip={statusLabel}>
        <Link href="/sources">
          <PlugZap />
          <span className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium">{statusLabel}</span>
            {freshest ? (
              <span className="text-xs text-sidebar-foreground/55">
                {freshest.name} synced {freshnessLabel(freshest.lastSyncedMinutesAgo ?? 0)}
              </span>
            ) : (
              <span className="text-xs text-sidebar-foreground/55">Connect a tool to get started</span>
            )}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
