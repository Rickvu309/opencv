"use client";

import Link from "next/link";

import { KIND_DOT, KIND_ICON } from "@/components/opportunities/opportunity-activity-tab";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { buildWhatChangedDigest } from "@/lib/home-utils";
import { isCopilotActivityKind } from "@/lib/opportunity-utils";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Home's "What changed" module (RDS-993): the 4 most recent activity
 * moments across every opportunity, one line each, read straight off the
 * existing Activity log rather than a new data shape. Serial Position:
 * this is the last content module on the page, decisions and today's
 * actions come first, a look-back digest comes last.
 */
export function WhatChangedDigest() {
  const { state } = useStore();
  const items = buildWhatChangedDigest(state.activityMoments, state.opportunities);

  return (
    <section className="flex flex-col gap-3">
      <h2>What changed</h2>
      {items.length === 0 ? (
        <EmptyState message="Nothing to report yet. Activity across your opportunities will show up here." />
      ) : (
        <Card className="ring-foreground/8 py-0">
          <CardContent className="flex flex-col gap-0 px-0">
            {items.map((item, index) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40",
                    index > 0 && "border-t border-border"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-white",
                      KIND_DOT[item.kind]
                    )}
                  >
                    <Icon className="size-3" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    <span className="text-muted-foreground">{item.objectLabel} — </span>
                    {item.message}
                  </span>
                  {isCopilotActivityKind(item.kind) ? <CopilotTag className="shrink-0" /> : null}
                  <span className="shrink-0 text-xs text-muted-foreground">{item.createdAt}</span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
