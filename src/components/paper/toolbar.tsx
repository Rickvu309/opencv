"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function PaperToolbar({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5",
        compact ? "min-h-10" : "min-h-12",
      )}
    >
      {children}
    </div>
  );
}
