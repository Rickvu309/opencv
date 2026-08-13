/**
 * Builds one trace.
 *
 * Pure: nothing here writes to a database or opens a socket, so a turn can be
 * traced in a test without either. Handing the finished trace somewhere is the
 * caller's job.
 */

import {
  truncateSample,
  type AgentTrace,
  type GuardrailViolation,
  type SpanAttributes,
  type SpanKind,
  type TraceSpan,
  type TurnOutcome,
  type ViolationSeverity,
} from "@/lib/trace/types";

/** An id that does not need a database round trip to exist. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export type Collector = {
  readonly traceId: string;
  /** Record a step that has already happened. */
  span: (span: {
    name: string;
    kind: SpanKind;
    startedAt: number;
    endedAt?: number;
    status?: "ok" | "error";
    attributes?: SpanAttributes;
  }) => TraceSpan;
  /**
   * Time a promise and record a span either way.
   *
   * Either way matters: the step that failed is the one worth having a span
   * for, and a `try` that only records on success quietly loses every error.
   */
  measure: <T>(
    step: { name: string; kind: SpanKind; attributes?: SpanAttributes },
    run: () => Promise<T>,
  ) => Promise<T>;
  /** Record something a guard refused. */
  violation: (violation: {
    guard: "input" | "output";
    rule: string;
    severity: ViolationSeverity;
    detail: string;
    sample?: string;
  }) => GuardrailViolation;
  violations: () => GuardrailViolation[];
  /** Close the trace and hand back what was collected. */
  finish: (outcome?: TurnOutcome) => AgentTrace;
};

export function newCollector(options: {
  traceId?: string;
  accountId?: string | null;
  /** Injected so tests are not at the mercy of the clock. */
  now?: () => number;
} = {}): Collector {
  const now = options.now ?? (() => Date.now());
  const traceId = options.traceId ?? newId();
  const accountId = options.accountId ?? null;
  const startedAt = now();
  const spans: TraceSpan[] = [];
  const violations: GuardrailViolation[] = [];

  function record(span: {
    name: string;
    kind: SpanKind;
    startedAt: number;
    endedAt?: number;
    status?: "ok" | "error";
    attributes?: SpanAttributes;
  }): TraceSpan {
    const endedAt = span.endedAt ?? now();
    const entry: TraceSpan = {
      id: newId(),
      name: span.name,
      kind: span.kind,
      startedAt: span.startedAt,
      endedAt,
      durationMs: Math.max(0, endedAt - span.startedAt),
      status: span.status ?? "ok",
      attributes: span.attributes ?? {},
    };
    spans.push(entry);
    return entry;
  }

  return {
    traceId,
    span: record,

    async measure(step, run) {
      const began = now();
      try {
        const result = await run();
        record({ ...step, startedAt: began, status: "ok" });
        return result;
      } catch (error) {
        record({
          ...step,
          startedAt: began,
          status: "error",
          attributes: {
            ...step.attributes,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    },

    violation(violation) {
      const entry: GuardrailViolation = {
        id: newId(),
        traceId,
        accountId,
        guard: violation.guard,
        rule: violation.rule,
        severity: violation.severity,
        detail: violation.detail,
        sample: violation.sample ? truncateSample(violation.sample) : null,
        at: now(),
      };
      violations.push(entry);
      // A refusal is also a step of the turn, so it shows up in the timeline
      // next to the model call it stopped, not only in a separate list.
      record({
        name: `${violation.guard}:${violation.rule}`,
        kind: "guardrail",
        startedAt: entry.at,
        endedAt: entry.at,
        status: "error",
        attributes: { severity: violation.severity, rule: violation.rule },
      });
      return entry;
    },

    violations: () => [...violations],

    finish(outcome = "pending") {
      const endedAt = now();
      // The model and the cost are read off the spans rather than tracked
      // separately, so they cannot disagree with what actually ran.
      const modelSpans = spans.filter((span) => span.kind === "model");
      const model = modelSpans.at(-1)?.attributes.model;
      const costUsd = modelSpans.reduce(
        (total, span) => total + Number(span.attributes.costUsd ?? 0),
        0,
      );

      return {
        id: traceId,
        accountId,
        startedAt,
        endedAt,
        durationMs: Math.max(0, endedAt - startedAt),
        model: typeof model === "string" ? model : null,
        costUsd: modelSpans.length > 0 ? costUsd : null,
        outcome,
        spans: [...spans],
      };
    },
  };
}

/** What a model call cost, given the registry's price for it. */
export function costOf(
  price: { inputPerMillion: number; outputPerMillion: number },
  usage: { inputTokens?: number; outputTokens?: number },
): number {
  return (
    ((usage.inputTokens ?? 0) * price.inputPerMillion +
      (usage.outputTokens ?? 0) * price.outputPerMillion) /
    1_000_000
  );
}
