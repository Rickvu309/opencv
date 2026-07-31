"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useStore } from "@/lib/store";

export interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
}

/**
 * One header anatomy for every page template: sidebar toggle, title, an
 * optional one-line purpose, primary action, then the Copilot toggle. The
 * sidebar trigger lives here rather than inside the sidebar itself so it
 * stays reachable whether the sidebar is expanded, collapsed to icons, or
 * offcanvas on a narrower viewport.
 */
export function PageHeader({ title, description, primaryAction }: PageHeaderProps) {
  const { state, toggleCopilot } = useStore();

  return (
    <div className="flex items-start justify-between gap-4 border-b border-border bg-background px-6 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <SidebarTrigger className="mt-0.5" />
        <Separator orientation="vertical" className="mt-1 h-5" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="break-words">{title}</h1>
          {description ? <p className="break-words text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {primaryAction}
        <Button
          variant={state.copilot.open ? "secondary" : "outline"}
          size="sm"
          onClick={toggleCopilot}
          aria-pressed={state.copilot.open}
        >
          <Sparkles className="size-4" />
          Copilot
        </Button>
      </div>
    </div>
  );
}
