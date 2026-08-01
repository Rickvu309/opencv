"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AiSignalGlyphProps {
  opportunityId: string;
  count: number;
  className?: string;
}

/**
 * RDS-994's overview-level AI placement correction, affordance 2 of 2 (the
 * Focus strip is the other): a small indigo dot with a count, shown only
 * when an opportunity has pending signals. Never inline AI prose on a card
 * or row, this is the entire footprint. Clicking opens the opportunity's
 * own Overview tab, where the Signals section (the five-beat pattern)
 * already lives, the deeper reasoning stays where it lives rather than a
 * second drawer duplicating it.
 *
 * A plain button with a router push, not a Link: the board card renders
 * this inside its own outer anchor, and a nested `<a>` is invalid HTML
 * that fails hydration (the browser silently un-nests it, React then
 * detects the mismatch and regenerates the whole subtree). preventDefault
 * plus stopPropagation, the same two-part fix ComparisonCheckbox already
 * uses for the identical "interactive control inside a Link" shape.
 */
export function AiSignalGlyph({ opportunityId, count, className }: AiSignalGlyphProps) {
  const router = useRouter();

  if (count <= 0) return null;

  function handleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    router.push(`/opportunities/${opportunityId}#overview`);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${count} pending Copilot ${count === 1 ? "signal" : "signals"}`}
          onClick={handleClick}
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-200/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25",
            className
          )}
        >
          <Sparkles className="size-3" />
          {count}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {count === 1 ? "1 pending Copilot signal" : `${count} pending Copilot signals`}
      </TooltipContent>
    </Tooltip>
  );
}
