import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Small label that marks a block of UI as scripted Copilot output, so AI
 * content stays visually distinct from user-entered or static content.
 */
export function CopilotTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
        className
      )}
    >
      <Sparkles className="size-3" />
      Copilot
    </span>
  );
}
