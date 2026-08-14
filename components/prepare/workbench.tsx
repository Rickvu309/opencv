"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for CV and Letters: toolbar, leading pane, trailing canvas.
 *
 * Both artefacts live under Chuẩn bị. The difference is what each pane holds
 * (form + A4 vs list + writing sheet), not a second layout language.
 */
export function PrepareWorkbench({
  toolbar,
  leading,
  trailing,
  pane,
  leadingWidthClass = "lg:w-[26rem] xl:w-[30rem]",
  trailingClassName = "bg-muted/40",
  children,
}: {
  toolbar: React.ReactNode;
  leading: React.ReactNode;
  trailing: React.ReactNode;
  pane: "leading" | "trailing";
  leadingWidthClass?: string;
  trailingClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar}
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-e border-border",
            leadingWidthClass,
            pane === "trailing" ? "hidden lg:flex" : "flex",
          )}
        >
          {leading}
        </div>
        <div
          className={cn(
            "min-w-0 flex-1 overflow-y-auto",
            trailingClassName,
            pane === "leading" ? "hidden lg:block" : "block",
          )}
        >
          {trailing}
        </div>
      </div>
      {children}
    </div>
  );
}

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

export function PreparePaneSwitch({
  pane,
  onPane,
  label,
  leadingLabel,
  trailingLabel,
}: {
  pane: "leading" | "trailing";
  onPane: (pane: "leading" | "trailing") => void;
  label: string;
  leadingLabel: string;
  trailingLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-md border border-border bg-card p-0.5 lg:hidden"
    >
      <Button
        size="sm"
        variant={pane === "leading" ? "secondary" : "ghost"}
        aria-pressed={pane === "leading"}
        className="h-7"
        onClick={() => onPane("leading")}
      >
        {leadingLabel}
      </Button>
      <Button
        size="sm"
        variant={pane === "trailing" ? "secondary" : "ghost"}
        aria-pressed={pane === "trailing"}
        className="h-7"
        onClick={() => onPane("trailing")}
      >
        {trailingLabel}
      </Button>
    </div>
  );
}
