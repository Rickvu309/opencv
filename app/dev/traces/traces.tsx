"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { AgentTrace, GuardrailViolation } from "@/lib/trace/types";
import { cn } from "@/lib/utils";

/**
 * The two lists, side by side in time.
 *
 * A trace is only useful if you can open it: the row says what the turn cost,
 * the spans inside say where the time went.
 */
export function Traces({
  traces,
  violations,
}: {
  traces: AgentTrace[];
  violations: GuardrailViolation[];
}) {
  return (
    <>
      <section className="mt-8">
        <h2 className="text-base font-semibold tracking-tight">Turns</h2>
        {traces.length === 0 ? (
          <Empty>No turns recorded yet. Talk to the Coach and reload.</Empty>
        ) : (
          <div className="mt-3 space-y-2">
            {traces.map((trace) => (
              <Turn key={trace.id} trace={trace} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          Guardrail violations
        </h2>
        {violations.length === 0 ? (
          <Empty>Nothing refused. Either the guards are quiet or they are off.</Empty>
        ) : (
          <div className="mt-3 space-y-2">
            {violations.map((violation) => (
              <Violation key={violation.id} violation={violation} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function Turn({ trace }: { trace: AgentTrace }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-xl border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm">
          {new Date(trace.startedAt).toLocaleString()}
          {trace.model ? ` · ${trace.model}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {trace.durationMs === null ? "" : `${trace.durationMs} ms`}
          {trace.costUsd === null ? "" : ` · $${trace.costUsd.toFixed(6)}`}
          <Outcome outcome={trace.outcome} />
        </span>
      </button>

      {open && (
        <ol className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
          {trace.spans.length === 0 && (
            <li className="text-muted-foreground">No spans.</li>
          )}
          {trace.spans.map((span) => (
            <li key={span.id} className="flex items-baseline gap-2">
              <span
                className={cn(
                  "shrink-0 font-mono",
                  span.status === "error" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {span.kind}
              </span>
              <span className="min-w-0 flex-1 break-all">{span.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {span.durationMs} ms
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Whether the user kept it. The one signal here that came from a person. */
function Outcome({ outcome }: { outcome: AgentTrace["outcome"] }) {
  if (outcome === "undone") return <Badge variant="destructive">undone</Badge>;
  if (outcome === "applied") return <Badge variant="secondary">applied</Badge>;
  return <Badge variant="outline">pending</Badge>;
}

function Violation({ violation }: { violation: GuardrailViolation }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {violation.guard} · {violation.rule}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {new Date(violation.at).toLocaleString()}
          <Badge
            variant={violation.severity === "block" ? "destructive" : "secondary"}
          >
            {violation.severity}
          </Badge>
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{violation.detail}</p>
      {violation.sample && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {violation.sample}
        </pre>
      )}
    </div>
  );
}
