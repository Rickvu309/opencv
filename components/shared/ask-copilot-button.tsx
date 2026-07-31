"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AskCopilotButtonProps {
  surface: string;
  objectLabel?: string;
  label?: string;
  className?: string;
}

/**
 * The one consistent inline entry point into the Copilot panel: a small
 * ghost button in a section header that opens the panel already set to that
 * section's context, with its prompt starters ready. Used across detail
 * tabs, profile sections, CV detail, goals zones, and skills zones so the
 * pattern reads the same everywhere it appears.
 */
export function AskCopilotButton({ surface, objectLabel, label = "Ask Copilot", className }: AskCopilotButtonProps) {
  const { setCopilotSurface, setCopilotOpen } = useStore();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn("text-muted-foreground", className)}
      onClick={() => {
        setCopilotSurface(surface, objectLabel);
        setCopilotOpen(true);
      }}
    >
      <Sparkles className="size-3.5" />
      {label}
    </Button>
  );
}
