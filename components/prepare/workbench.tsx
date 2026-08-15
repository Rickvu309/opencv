"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function PrepareToolbar({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-border px-3",
        compact ? "h-10" : "h-12",
      )}
    >
      {children}
    </div>
  );
}
