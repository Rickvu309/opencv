/**
 * Is the Coach getting worse?
 *
 * ## The signal, and why it is the undo button
 *
 * ADR-002 says user acceptance is a primary quality signal, and the traces
 * carry it: every turn that changed something is `applied`, and every one the
 * user reversed is `undone`. A rising undo rate is the product telling you it
 * has got worse, in the words of the people using it, without a rubric or a
 * judge.
 *
 * ## Why a comparison and not a threshold
 *
 * "Alert when the undo rate exceeds 20%" needs somebody to know what 20% means,
 * and nobody does before launch. Comparing this week against the weeks before
 * needs no such number: whatever the normal rate is, a jump from it is worth
 * looking at. The only constant here is how big a jump counts, and how much
 * traffic is needed before a jump means anything.
 */

import type { AgentTrace } from "@/lib/trace/types";

/** Below this many turns, a percentage is noise. */
export const MIN_SAMPLE = 20;

/** A relative worsening this large is worth saying out loud. */
export const DRIFT_THRESHOLD = 0.5;

export type Rates = {
  turns: number;
  /** Turns that changed something and were kept. */
  applied: number;
  /** Turns that changed something and were reversed. */
  undone: number;
  /** undone / (applied + undone), or null when nothing changed anything. */
  undoRate: number | null;
};

export function rates(traces: readonly AgentTrace[]): Rates {
  const applied = traces.filter((trace) => trace.outcome === "applied").length;
  const undone = traces.filter((trace) => trace.outcome === "undone").length;
  const decided = applied + undone;
  return {
    turns: traces.length,
    applied,
    undone,
    undoRate: decided === 0 ? null : undone / decided,
  };
}

export type DriftVerdict =
  | { kind: "ok"; reason: string }
  | { kind: "insufficient"; reason: string }
  | { kind: "drift"; reason: string; from: number; to: number };

/**
 * Compare a recent window against the one before it.
 *
 * Three outcomes rather than a boolean, because "not enough data to say" is a
 * different answer from "fine", and reporting the first as the second is how a
 * quiet week gets mistaken for a healthy one.
 */
export function detectDrift(
  recent: readonly AgentTrace[],
  baseline: readonly AgentTrace[],
): DriftVerdict {
  const now = rates(recent);
  const before = rates(baseline);

  if (now.applied + now.undone < MIN_SAMPLE) {
    return {
      kind: "insufficient",
      reason: `only ${now.applied + now.undone} decided turns in the window`,
    };
  }
  if (before.undoRate === null || before.applied + before.undone < MIN_SAMPLE) {
    return { kind: "insufficient", reason: "no baseline to compare against" };
  }

  const from = before.undoRate;
  const to = now.undoRate ?? 0;

  // A relative jump, with an absolute floor. Without the floor, 1% to 2% is a
  // 100% rise and an alert nobody should be woken for.
  if (to > 0.05 && to - from > Math.max(0.05, from * DRIFT_THRESHOLD)) {
    return {
      kind: "drift",
      reason: `undo rate rose from ${(from * 100).toFixed(1)}% to ${(to * 100).toFixed(1)}%`,
      from,
      to,
    };
  }

  return {
    kind: "ok",
    reason: `undo rate ${(to * 100).toFixed(1)}%, baseline ${(from * 100).toFixed(1)}%`,
  };
}
