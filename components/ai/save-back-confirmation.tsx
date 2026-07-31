"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveBackConfirmationProps {
  message: string;
  onUndo?: () => void;
  className?: string;
}

/**
 * Beat 5's save-back state: shown right after Approve, names exactly what
 * changed, with an Undo. AiActionCard is the one that decides when this
 * settles into the quiet done row, this component only renders the
 * confirmation itself.
 */
export function SaveBackConfirmation({ message, onUndo, className }: SaveBackConfirmationProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10",
        className
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <Check className="size-3.5 shrink-0" />
        {message}
      </span>
      {onUndo ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 px-2 text-xs text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
          onClick={onUndo}
        >
          Undo
        </Button>
      ) : null}
    </div>
  );
}
