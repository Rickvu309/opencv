import { useEffect, useRef, useState } from "react";
import { Button } from "@/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PayloadView } from "@/features/coach/components/payload-view";
import type { ApprovalView } from "@/features/coach/model";
import { runCommand } from "@/ui/run-command";

const SETTLE_HOLD_MS = 800;

interface ApprovalCardProps {
  approval: ApprovalView;
  onDecided?: (kind: "once" | "session" | "rejected") => void;
}

function ApprovalCard({ approval, onDecided }: ApprovalCardProps) {
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"once" | "session" | "rejected" | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  async function decide(kind: "once" | "session" | "rejected") {
    setSubmitting(true);
    setError(null);
    setDecision(kind);
    try {
      if (kind !== "rejected") {
        await runCommand(approval.command, approval.input);
      }
      window.setTimeout(() => {
        if (mounted.current) onDecided?.(kind);
      }, SETTLE_HOLD_MS);
    } catch (e) {
      setDecision(null);
      setError(e instanceof Error ? e.message : "Couldn't apply that. Try again.");
      setOpen(true);
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  const decided = decision !== null;
  const headline = approval.description || approval.command;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-container)] border bg-surface-1",
        decided
          ? decision === "rejected"
            ? "border-destructive/40"
            : "border-status-positive/50"
          : "border-accent/40",
      )}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-1 pr-2">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-h-10 min-w-0 flex-1 items-center gap-2 px-3 text-left">
              <span className="truncate text-[13px] text-ink-muted">
                {decided ? headline : `Needs you: ${headline}`}
              </span>
            </button>
          </CollapsibleTrigger>
          {decided ? (
            <span className="px-2 text-[13px] font-[510]">
              {decision === "rejected" ? "Not now" : "Done"}
            </span>
          ) : null}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              aria-label={open ? "Hide details" : "Show details"}
              className="p-1.5"
            >
              <ChevronDown
                className={cn(
                  "size-4 text-ink-muted transition-transform duration-150",
                  !open && "-rotate-90",
                )}
              />
            </button>
          </CollapsibleTrigger>
        </div>
        {!decided ? (
          <div className="flex flex-wrap justify-end gap-1 px-3 pb-2">
            <Button size="sm" disabled={submitting} onClick={() => void decide("once")}>
              Do it
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => void decide("session")}
            >
              Don't ask again in this conversation
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting}
              onClick={() => void decide("rejected")}
            >
              Not now
            </Button>
          </div>
        ) : null}
        <CollapsibleContent>
          <div className="flex flex-col gap-2 p-3">
            <PayloadView payload={approval.input} />
            {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export { ApprovalCard };
