/**
 * Sending a trace from the browser.
 *
 * ## Why the browser and not the agent
 *
 * The Coach turn runs inside eve, which owns its own model call. The browser is
 * the only participant that sees the whole turn: when the user sent it, when
 * the last token arrived, which tool envelopes were applied, and whether the
 * change was undone a moment later. That is the trace worth having, so this is
 * where it is assembled.
 *
 * The model call's own span (tokens, cost) is recorded server-side by the
 * gateway. Joining the two would need a turn id threaded through eve's stream,
 * which this work order does not do.
 *
 * Every function here is fire and forget. A sink that can take a turn down is
 * worse than no sink.
 */

import type { AgentTrace, TurnOutcome } from "@/lib/trace/types";

async function post(body: unknown): Promise<void> {
  try {
    await fetch("/api/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // A trace is diagnostic. It must never hold up a page leaving.
      keepalive: true,
    });
  } catch {
    // Deliberately silent. The user has nothing to do about it, and the turn
    // they are in the middle of matters more than the record of it.
  }
}

/** Store a finished turn. */
export function emitTrace(trace: AgentTrace): void {
  void post({ trace });
}

/** Tell the sink the user kept, or undid, what the Coach did. */
export function emitOutcome(traceId: string, outcome: TurnOutcome): void {
  void post({ traceId, outcome });
}
