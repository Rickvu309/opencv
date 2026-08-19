import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "../../cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../collapsible";
import "./beautiful.css";

export type ToolChipKind = "thinking" | "edit" | "call";

export interface ToolChip {
  id: string;
  kind: ToolChipKind;
  label: string;
  query: string;
  traces?: string[];
  diff?: { file: string; added: number; removed: number };
}

export interface ToolChipsProps {
  summary?: string;
  items?: ToolChip[];
}

const DEFAULT_ITEMS: ToolChip[] = [
  {
    id: "think",
    kind: "thinking",
    label: "Thinking",
    query: "Planning the schedule…",
    traces: [
      "Weekend demand carries the north batch, so it runs first.",
      "Batch capacity leaves two evening windows.",
    ],
  },
  {
    id: "edit",
    kind: "edit",
    label: "Edit",
    query: "Write 24 lines schedule.ts",
    diff: { file: "schedule.ts", added: 18, removed: 6 },
  },
  {
    id: "read",
    kind: "call",
    label: "Read",
    query: "records.csv",
  },
  {
    id: "search",
    kind: "call",
    label: "Search",
    query: "lead time by vendor",
  },
];

export function ToolChips({
  summary = "4 tool calls, 2 messages",
  items = DEFAULT_ITEMS,
}: ToolChipsProps) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="min-h-[13.75rem] w-full max-w-80">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="-mx-1.5 flex w-fit items-center gap-1.5 rounded-[var(--radius-control)] px-1.5 py-1 text-[12.5px] text-ink-secondary transition-colors duration-[var(--duration-fast)] hover:bg-surface-2">
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              !open && "-rotate-90",
            )}
            aria-hidden="true"
          />
          <span className="tabular-nums">{summary}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 flex flex-col gap-1">
            {items.map((item) => {
              const rowOpen = expanded === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    aria-expanded={rowOpen}
                    className="group flex h-7 w-full min-w-0 items-center gap-2 rounded-[var(--radius-control)] px-[3px] text-left transition-colors duration-[var(--duration-fast)] hover:bg-surface-2"
                    onClick={() => setExpanded(rowOpen ? null : item.id)}
                  >
                    <span className="relative flex size-4 shrink-0 items-center justify-center text-ink-faint">
                      <Sparkles className="size-3.5 group-hover:opacity-0" aria-hidden="true" />
                      <ChevronDown
                        className={cn(
                          "absolute size-3 opacity-0 transition-[opacity,transform] duration-[var(--duration-fast)] group-hover:opacity-100",
                          rowOpen ? "rotate-0" : "-rotate-90",
                        )}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="shrink-0 text-[12.5px] font-[510] text-ink">{item.label}</span>
                    <span className="inline-flex h-5 min-w-0 flex-1 cursor-pointer items-center truncate rounded-[var(--radius-pill)] bg-surface-2 px-1.5 font-mono text-[11.5px] text-ink-secondary">
                      {item.query}
                    </span>
                  </button>
                  {rowOpen && item.traces ? (
                    <div className="mt-0.5 mb-1 ml-2 flex flex-col gap-0.5 border-l border-hairline py-0.5 pl-3.5">
                      {item.traces.map((trace) => (
                        <span key={trace} className="truncate text-[11.5px] leading-[1.6] text-ink-secondary">
                          {trace}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {rowOpen && item.diff ? (
                    <div className="mt-0.5 mb-1 ml-6 font-mono text-[11.5px] text-ink-muted">
                      <span className="text-status-positive">+{item.diff.added}</span>
                      <span className="mx-1 text-destructive">-{item.diff.removed}</span>
                      {item.diff.file}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
