"use client";

/**
 * One trace per Coach turn, opened and closed by the browser.
 *
 * The turn begins when the agent starts working and ends when it stops. In
 * between, every `apply_action` envelope the thread applies becomes a span, so
 * the finished trace says what the Coach did and how long the user waited for
 * it.
 *
 * Not a general-purpose tracer. It knows about exactly one thing, a Coach turn,
 * because that is the only thing in the product that has turns.
 */

import * as React from "react";

import { newCollector, type Collector } from "@/lib/trace/collector";
import { emitTrace } from "@/lib/trace/client";

export type TurnTrace = {
  /** The trace the current turn belongs to, or null between turns. */
  traceId: string | null;
  /** Record a tool call the Coach made. */
  toolSpan: (name: string, attributes?: Record<string, string>) => void;
};

export function useTurnTrace(turnRunning: boolean): TurnTrace {
  const collector = React.useRef<Collector | null>(null);
  const [traceId, setTraceId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (turnRunning) {
      // A turn already in flight keeps its trace. `turnRunning` can re-fire
      // when the stream switches from submitted to streaming, and starting a
      // second trace there would split one turn across two records.
      if (collector.current) return;
      const next = newCollector();
      collector.current = next;
      setTraceId(next.traceId);
      return;
    }

    const finished = collector.current;
    if (!finished) return;
    collector.current = null;
    setTraceId(null);
    // A turn that changed nothing is still worth a row: latency and the fact
    // it produced no action are both answers. A turn that did change something
    // starts as `applied`, and becomes `undone` if the user presses undo.
    const trace = finished.finish();
    const changed = trace.spans.some((span) => span.kind === "tool");
    emitTrace({ ...trace, outcome: changed ? "applied" : "pending" });
  }, [turnRunning]);

  const toolSpan = React.useCallback(
    (name: string, attributes: Record<string, string> = {}) => {
      const at = Date.now();
      collector.current?.span({
        name,
        kind: "tool",
        startedAt: at,
        endedAt: at,
        attributes,
      });
    },
    [],
  );

  return { traceId, toolSpan };
}
