"use client";

import { Mail } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { connectedSources } from "@/lib/data/sources";

function freshnessLabel(minutes: number): string {
  if (minutes < 60) return `Synced ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `Synced ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/**
 * The quiet sidebar affordance for the connected-sources model: shows Email
 * connected with its freshness, opens a small dialog listing every source
 * and what Copilot reads from it. Simulated only, nothing here reaches a
 * real inbox.
 */
export function ConnectedSourcesButton() {
  const email = connectedSources.find((source) => source.type === "email");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <Mail className="size-4 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-medium">Email connected</span>
            {email ? (
              <span className="text-xs text-sidebar-foreground/50">{freshnessLabel(email.lastSyncedMinutesAgo)}</span>
            ) : null}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connected sources</DialogTitle>
          <DialogDescription>Simulated for this prototype, nothing here reaches a real inbox.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {connectedSources.map((source) => (
            <div key={source.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {source.name} · {source.provider}
                </span>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{freshnessLabel(source.lastSyncedMinutesAgo)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{source.readsDescription}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
