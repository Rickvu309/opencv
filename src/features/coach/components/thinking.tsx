import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/collapsible";
import { formatElapsed, stepsFromReasoning, type ReasoningStep } from "./reasoning";

export type { ReasoningStep };
export { formatElapsed, stepsFromReasoning };

export interface ReasoningPanelProps {
  content?: string;
  steps?: ReasoningStep[];
  streaming: boolean;
  defaultOpen?: boolean;
  restingLabel?: string;
  className?: string;
}

export interface ThinkingCardProps {
  content: string;
  isStreaming: boolean;
  defaultOpen?: boolean;
}

export function ReasoningPanel({
  content = "",
  steps,
  streaming,
  defaultOpen = false,
  restingLabel,
  className,
}: ReasoningPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [seconds, setSeconds] = useState(0);
  const openedForStream = useRef(false);
  const shown = steps ?? stepsFromReasoning(content);
  const settled = restingLabel ?? (seconds > 0 ? `Thought for ${formatElapsed(seconds)}` : "Thinking");

  useEffect(() => {
    if (!streaming) {
      openedForStream.current = false;
      return;
    }
    setSeconds(0);
    const started = Date.now();
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [streaming]);

  useEffect(() => {
    if (!streaming || !shown.length || openedForStream.current) return;
    openedForStream.current = true;
    setOpen(true);
  }, [streaming, shown.length]);

  if (!shown.length && !streaming) return null;

  return (
    <Collapsible
      data-slot="reasoning-panel"
      open={open}
      onOpenChange={setOpen}
      className={cn("group w-full", className)}
    >
      <CollapsibleTrigger className="flex min-h-[var(--size-touch)] items-center gap-1.5 py-1 text-left text-[13px] text-ink-muted transition-[color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-ink active:scale-[0.97] md:min-h-10">
        {streaming ? (
          <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
            <span className="think-shimmer relative inline-block leading-none">Thinking</span>
            {seconds > 0 ? (
              <span className="text-ink-faint tabular-nums">{formatElapsed(seconds)}</span>
            ) : null}
          </span>
        ) : (
          <span className="min-w-0 truncate">{settled}</span>
        )}
        <ChevronDown
          className="size-3.5 shrink-0 opacity-60 transition-transform duration-[150ms] ease-[var(--ease-out)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {shown.length ? (
          <ol className="flex max-h-48 flex-col gap-4 overflow-y-auto pt-3 pb-1">
            {shown.map((step, i) => {
              const active = streaming && i === shown.length - 1;
              return (
                <li key={`${step.title}-${i}`} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[7px] size-[5px] shrink-0 rounded-full transition-colors duration-[var(--duration-base)] ease-[var(--ease-out)]",
                      active ? "bg-accent motion-safe:animate-pulse" : "bg-ink-faint",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <p className="text-[13px] font-[510] text-ink">{step.title}</p>
                    {step.body ? (
                      <p className="mt-1 text-[13px] leading-[1.5] break-words text-ink-muted">
                        {step.body}
                      </p>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ThinkingCard({ content, isStreaming, defaultOpen }: ThinkingCardProps) {
  return <ReasoningPanel content={content} streaming={isStreaming} defaultOpen={defaultOpen} />;
}
