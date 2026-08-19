import { GitBranch, Zap } from "lucide-react";
import { cn } from "../../cn";
import "./beautiful.css";

export interface FlowNode {
  kind: "trigger" | "condition";
  title: string;
  body: string;
  clauses?: { field: string; value: string }[];
}

export interface FlowchartProps {
  nodes?: FlowNode[];
}

const DEFAULT_NODES: FlowNode[] = [
  {
    kind: "trigger",
    title: "New order created",
    body: "Trigger when a new order is created",
  },
  {
    kind: "condition",
    title: "If / Else",
    body: "If order line is North batch",
    clauses: [
      { field: "line", value: "North batch" },
      { field: "topping", value: "Brown butter crunch" },
    ],
  },
];

export function Flowchart({ nodes = DEFAULT_NODES }: FlowchartProps) {
  return (
    <div
      className="relative h-[21rem] w-full overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-canvas"
      style={{
        backgroundImage: "radial-gradient(var(--hairline) 1px, transparent 1.25px)",
        backgroundSize: "22px 22px",
        backgroundPosition: "center",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-[7.25rem] left-1/2 h-16 w-px -translate-x-1/2 bg-hairline"
      />
      <div className="absolute top-6 left-1/2 flex w-[18.75rem] -translate-x-1/2 flex-col items-start gap-1.5">
        <KindBadge kind="trigger">Trigger</KindBadge>
        <button
          type="button"
          className="w-full rounded-[var(--radius-container)] border border-hairline bg-surface-1 px-3 py-2.5 text-left transition-[background-color] duration-[var(--duration-fast)] hover:bg-surface-2"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-surface-2 text-ink">
              <Zap className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-[590] text-ink">{nodes[0]?.title}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-secondary">
                {nodes[0]?.body}
              </span>
            </span>
          </span>
        </button>
      </div>
      <div className="absolute top-44 left-1/2 flex w-[22rem] -translate-x-1/2 flex-col items-start gap-1.5">
        <KindBadge kind="condition">If / Else</KindBadge>
        <div className="w-full rounded-[var(--radius-container)] border border-hairline bg-surface-1 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-surface-2 text-ink">
              <GitBranch className="size-4" aria-hidden="true" />
            </span>
            <span className="text-[13px] text-ink-secondary">
              If <Field>{nodes[1]?.clauses?.[0]?.field ?? "line"}</Field> is{" "}
              <Field>{nodes[1]?.clauses?.[0]?.value ?? "North batch"}</Field>
            </span>
          </div>
          {nodes[1]?.clauses?.[1] ? (
            <p className="mt-1.5 pl-11 text-[13px] text-ink-secondary">
              and <Field>{nodes[1].clauses[1].field}</Field> is{" "}
              <Field>{nodes[1].clauses[1].value}</Field>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KindBadge({ kind, children }: { kind: FlowNode["kind"]; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-[var(--radius-control)] px-2 text-[11.5px] font-[510]",
        kind === "trigger"
          ? "bg-surface-3 text-ink"
          : "bg-[color-mix(in_srgb,var(--status-attention)_14%,var(--canvas))] text-status-attention",
      )}
    >
      {children}
    </span>
  );
}

function Field({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="mx-0.5 inline-flex h-6 items-center rounded-[var(--radius-control)] bg-surface-2 px-1.5 font-mono text-[12px] text-ink"
    >
      {children}
    </button>
  );
}
