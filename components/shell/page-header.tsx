"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
}

export function PageHeader({ title, description, primaryAction }: PageHeaderProps) {
  const { state, toggleCopilot } = useStore();

  return (
    <div className="flex items-start justify-between gap-4 border-b border-border bg-background px-6 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="break-words">{title}</h1>
        {description ? <p className="break-words text-sm text-muted-foreground">{description}</p> : null}
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
