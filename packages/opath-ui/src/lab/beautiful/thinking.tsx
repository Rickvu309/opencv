import { Check, ChevronDown, Code2, Search as SearchIcon, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "../../cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../collapsible";
import "./beautiful.css";
import { DemoSwitch } from "./demo-switch";
import { usePrefersReducedMotion } from "./hooks";

export type ThinkingKind = "steps" | "reasoning" | "search" | "coding";

export interface ThinkingStep {
  title: string;
  detail?: string;
  duration?: string;
}

export interface ThinkingProps {
  label?: string;
  settledLabel?: string;
  streaming?: boolean;
  kind?: ThinkingKind;
  steps?: ThinkingStep[];
  reasoning?: string;
  queries?: string[];
  files?: string[];
  showSwitcher?: boolean;
}

const DEFAULT_STEPS: ThinkingStep[] = [
  { title: "Reading the brief" },
  { title: "Scanning related records" },
  { title: "Comparing notes", duration: "6s" },
  { title: "Drafting a summary" },
];

export function Thinking({
  label = "Thinking",
  settledLabel = "Thought for 4s",
  streaming = false,
  kind: kindProp,
  steps = DEFAULT_STEPS,
  reasoning = "Weekend demand is concentrated on the north batch, so it should run first. Capacity leaves two evening windows if the afternoon slot slips.",
  queries = ["north batch weekend demand", "vendor lead times Q4"],
  files = ["schedule.ts", "records.csv"],
  showSwitcher = true,
}: ThinkingProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ThinkingKind>(kindProp ?? "steps");
  const reduced = usePrefersReducedMotion();
  const title = streaming ? label : settledLabel;

  return (
    <div className="flex w-full max-w-[24rem] flex-col">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="-mx-1.5 flex w-fit items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1 text-left transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-2"
          aria-expanded={open}
        >
          <Sparkles className="size-4 text-ink-faint" aria-hidden="true" />
          <span
            className={cn(
              "whitespace-nowrap text-[13px] font-[510]",
              streaming && !reduced ? "beautiful-shimmer" : "text-ink-secondary",
            )}
            role="status"
          >
            {title}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 text-ink-faint transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="relative mt-1 ml-[5px] pl-4">
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-2 left-[3px] w-px bg-hairline"
            />
            {kind === "steps" ? (
              <ol className="flex flex-col gap-1 py-1">
                {steps.map((step, i) => (
                  <li
                    key={step.title}
                    className={cn(
                      "flex min-h-7 w-full items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-0.5",
                      !reduced && "beautiful-fade-up",
                    )}
                    style={{ animationDelay: reduced ? undefined : `${i * 120}ms` }}
                  >
                    <Check className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                    <span className="min-w-0 truncate text-[12.5px] font-[510] text-ink">
                      {step.title}
                    </span>
                    {step.duration ? (
                      <span className="shrink-0 text-[11.5px] text-ink-faint tabular-nums">
                        {step.duration}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {kind === "reasoning" ? (
              <p className="py-2 text-[12.5px] leading-[1.6] text-ink-secondary">{reasoning}</p>
            ) : null}
            {kind === "search" ? (
              <ul className="flex flex-col gap-1 py-2">
                {queries.map((query) => (
                  <li key={query} className="flex items-center gap-2">
                    <SearchIcon className="size-3.5 text-ink-faint" aria-hidden="true" />
                    <span className="truncate rounded-[var(--radius-pill)] bg-surface-2 px-2 py-0.5 font-mono text-[11.5px] text-ink-secondary">
                      {query}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {kind === "coding" ? (
              <ul className="flex flex-col gap-1 py-2">
                {files.map((file) => (
                  <li key={file} className="flex items-center gap-2">
                    <Code2 className="size-3.5 text-ink-faint" aria-hidden="true" />
                    <span className="font-mono text-[12px] text-ink">{file}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
      {showSwitcher ? (
        <DemoSwitch
          value={kind}
          onChange={setKind}
          options={["steps", "reasoning", "search", "coding"] as const}
        />
      ) : null}
    </div>
  );
}
