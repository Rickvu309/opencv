import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Subtle attention cue for a stale opportunity: a small dot, not a badge, so
 * it reads as a quiet supporting cue rather than another chip.
 */
export function AttentionDot({ reason }: { reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`Needs attention: ${reason}`}
          className="inline-block size-1.5 shrink-0 rounded-full bg-rose-500"
        />
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
