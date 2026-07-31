"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InboxItemCard } from "@/components/sources/inbox-item-card";
import { buildSyncStatusLine, getInboxItems } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";

type StatusFilter = "needs-review" | "linked" | "all";

/**
 * The main zone of /sources: every evidence item from a connected source,
 * newest first, filterable by review state and by source. Dismissed items
 * never show here (their "Not relevant, Undo" toast is the recovery path,
 * the same pattern nudges and next actions already use), so "All" means
 * everything not yet dismissed.
 */
export function SyncedContextInbox() {
  const { state } = useStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("needs-review");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const visibleItems = useMemo(
    () => getInboxItems(state).filter((item) => item.status !== "dismissed"),
    [state]
  );

  const sourceOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of visibleItems) seen.set(item.source.id, item.source.name);
    return Array.from(seen.entries());
  }, [visibleItems]);

  const filtered = visibleItems.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (sourceFilter !== "all" && item.source.id !== sourceFilter) return false;
    return true;
  });

  const syncLine = buildSyncStatusLine(state.connectedSources);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2>Synced context</h2>
        <span className="text-xs text-muted-foreground">{syncLine}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={statusFilter}
          onValueChange={(value) => value && setStatusFilter(value as StatusFilter)}
        >
          <ToggleGroupItem value="needs-review">Needs review</ToggleGroupItem>
          <ToggleGroupItem value="linked">Linked</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>

        {sourceOptions.length > 1 ? (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={sourceFilter}
            onValueChange={(value) => value && setSourceFilter(value)}
          >
            <ToggleGroupItem value="all">All sources</ToggleGroupItem>
            {sourceOptions.map(([id, name]) => (
              <ToggleGroupItem key={id} value={id}>
                {name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Nothing here yet. Connect a tool above, or adjust the filters." />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <InboxItemCard key={item.evidence.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
