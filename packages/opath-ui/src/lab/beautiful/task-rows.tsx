import { Check, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { cn } from "../../cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../collapsible";
import "./beautiful.css";
import { DemoSwitch } from "./demo-switch";
import { usePrefersReducedMotion } from "./hooks";

export type TaskStatus = "running" | "failed" | "completed";
export type TaskRowsVariant = "capsules" | "list";

export interface TaskDetail {
  label: string;
  meta: string;
}

export interface TaskRow {
  id: string;
  title: string;
  meta: string;
  status: TaskStatus;
  index?: number;
  details?: TaskDetail[];
}

export interface TaskRowsProps {
  tasks?: TaskRow[];
  variant?: TaskRowsVariant;
  showSwitcher?: boolean;
}

const DEFAULT_TASKS: TaskRow[] = [
  {
    id: "verify",
    title: "Verified vendor records",
    meta: "12 vendors",
    status: "completed",
    details: [
      { label: "Matched tax and contact IDs", meta: "12/12" },
      { label: "Flagged stale records", meta: "0" },
    ],
  },
  {
    id: "build",
    title: "Build reorder task list",
    meta: "7 SKUs",
    status: "running",
    index: 2,
    details: [
      { label: "Reading export", meta: "3 files" },
      { label: "Scoring stockout risk", meta: "68%" },
    ],
  },
  {
    id: "draft",
    title: "Draft vendor emails",
    meta: "2 messages",
    status: "failed",
    index: 3,
    details: [
      { label: "Vendor follow-up", meta: "draft" },
      { label: "Reorder note", meta: "draft" },
    ],
  },
];

function StatusMark({ status, reduced }: { status: TaskStatus; reduced: boolean }) {
  if (status === "completed") {
    return (
      <span className="flex size-[22px] items-center justify-center rounded-full bg-status-positive text-on-accent">
        <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex size-[22px] items-center justify-center rounded-full bg-destructive text-on-accent">
        <X className="size-3" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="relative inline-flex size-6 items-center justify-center">
      <svg width="24" height="24" viewBox="0 0 24 24" className={cn(!reduced && "beautiful-spin")}>
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="var(--hairline)"
          strokeWidth="2.2"
        />
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="var(--status-progress)"
          strokeWidth="2.2"
          strokeDasharray="14 36"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function TaskRows({
  tasks = DEFAULT_TASKS,
  variant: variantProp,
  showSwitcher = true,
}: TaskRowsProps) {
  const [variant, setVariant] = useState<TaskRowsVariant>(variantProp ?? "capsules");
  const [openId, setOpenId] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const capsules = variant === "capsules";

  return (
    <div className="flex w-full max-w-[28rem] flex-col gap-2">
      {tasks.map((task, i) => {
        const open = openId === task.id;
        return (
          <div
            key={task.id}
            className={cn(
              "self-stretch overflow-hidden border border-hairline bg-surface-1 transition-colors duration-[var(--duration-base)] hover:bg-surface-2",
              capsules ? "rounded-[var(--radius-pill)]" : "rounded-[var(--radius-container)]",
              !reduced && "beautiful-fade-up",
            )}
            style={{ animationDelay: reduced ? undefined : `${i * 80}ms` }}
          >
            <Collapsible
              open={open}
              onOpenChange={(next) => setOpenId(next ? task.id : null)}
            >
              <CollapsibleTrigger className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left">
                <span className="flex size-6 shrink-0 items-center justify-center">
                  {task.index && task.status !== "completed" ? (
                    <span className="text-[12px] font-[510] text-ink-muted tabular-nums">
                      {task.index}
                    </span>
                  ) : (
                    <StatusMark status={task.status} reduced={reduced} />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-[510] text-ink">
                  {task.title}
                </span>
                <span className="text-[12.5px] text-ink-secondary tabular-nums">{task.meta}</span>
                {task.status === "completed" ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-[color-mix(in_srgb,var(--status-positive)_16%,var(--surface-1))] px-2 text-[11.5px] font-[510] text-status-positive">
                    Completed
                  </span>
                ) : null}
                <ChevronDown
                  className={cn(
                    "size-4 text-ink-faint transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]",
                    open && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {task.details ? (
                  <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
                    <span aria-hidden="true" className="mx-auto h-full w-px bg-hairline" />
                    <div className="flex flex-col gap-1.5 pb-1">
                      {task.details.map((detail) => (
                        <div key={detail.label} className="flex items-center justify-between">
                          <span className="text-[12px] text-ink-secondary">{detail.label}</span>
                          <span className="font-mono text-[11.5px] text-ink-faint tabular-nums">
                            {detail.meta}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
      {showSwitcher ? (
        <DemoSwitch
          value={variant}
          onChange={setVariant}
          options={["capsules", "list"] as const}
        />
      ) : null}
    </div>
  );
}
