/**
 * What a turn did, in a shape something else can read.
 *
 * The blueprint's contract is "trace everything": a span per turn step, with
 * the model, the tokens, the cost, the latency, and whether the user kept the
 * change. This is that record. It is deliberately not the eval suite; nothing
 * here scores anything.
 */

/** Which kind of step a span describes. */
export type SpanKind = "model" | "tool" | "retrieval" | "guardrail";

/** What a step is allowed to say about itself. */
export type SpanAttributes = Record<string, string | number | boolean | null>;

export type TraceSpan = {
  id: string;
  name: string;
  kind: SpanKind;
  /** Epoch milliseconds, so a span is comparable across processes. */
  startedAt: number;
  endedAt: number;
  durationMs: number;
  status: "ok" | "error";
  attributes: SpanAttributes;
};

/**
 * Whether the user kept what the Coach did.
 *
 * ADR-002: the product already has a strong real signal in the undo button, so
 * evaluation reads it rather than relying only on a rubric. `pending` is a turn
 * that changed nothing, or one whose fate is not known yet.
 */
export type TurnOutcome = "pending" | "applied" | "undone";

export type AgentTrace = {
  id: string;
  accountId: string | null;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  /** The model the turn ran on, when the turn made a model call. */
  model: string | null;
  costUsd: number | null;
  outcome: TurnOutcome;
  spans: TraceSpan[];
};

/** How hard a guard came down on something. */
export type ViolationSeverity = "block" | "revise" | "flag";

export type GuardrailViolation = {
  id: string;
  traceId: string | null;
  accountId: string | null;
  guard: "input" | "output";
  /** The rule that fired, e.g. "injection" or "ungrounded-number". */
  rule: string;
  severity: ViolationSeverity;
  detail: string;
  /** The offending text, truncated. A violation you cannot see is one you cannot judge. */
  sample: string | null;
  at: number;
};

/** The longest sample worth storing. Enough to judge, short enough to be free. */
export const MAX_SAMPLE_CHARS = 500;

export function truncateSample(text: string): string {
  return text.length <= MAX_SAMPLE_CHARS
    ? text
    : `${text.slice(0, MAX_SAMPLE_CHARS)}…`;
}

const SPAN_KINDS: SpanKind[] = ["model", "tool", "retrieval", "guardrail"];
const OUTCOMES: TurnOutcome[] = ["pending", "applied", "undone"];

/** Is this a span, or something a client made up? */
export function looksLikeSpan(value: unknown): value is TraceSpan {
  if (typeof value !== "object" || value === null) return false;
  const span = value as Partial<TraceSpan>;
  return (
    typeof span.id === "string" &&
    typeof span.name === "string" &&
    SPAN_KINDS.includes(span.kind as SpanKind) &&
    typeof span.startedAt === "number" &&
    typeof span.endedAt === "number" &&
    (span.status === "ok" || span.status === "error")
  );
}

/**
 * Is this a trace?
 *
 * Checked on the way in, because the browser posts these and a browser is not
 * a thing the server gets to trust. A trace that fails this is dropped rather
 * than stored, since a malformed row would break the reader instead.
 */
export function looksLikeTrace(value: unknown): value is AgentTrace {
  if (typeof value !== "object" || value === null) return false;
  const trace = value as Partial<AgentTrace>;
  return (
    typeof trace.id === "string" &&
    trace.id.length > 0 &&
    typeof trace.startedAt === "number" &&
    OUTCOMES.includes(trace.outcome as TurnOutcome) &&
    Array.isArray(trace.spans) &&
    trace.spans.every(looksLikeSpan)
  );
}

export function isOutcome(value: unknown): value is TurnOutcome {
  return OUTCOMES.includes(value as TurnOutcome);
}
