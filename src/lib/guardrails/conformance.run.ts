/**
 * Running the conformance set and saying what happened.
 *
 * Separate from the set itself so the same cases can be run as a test and as a
 * recorded conformance run whose results land in the trace sink. The blueprint
 * asks for the guards' own accuracy to be measured rather than assumed, and a
 * pass rate nobody stores is not a measurement.
 */

import type { AppState } from "@/lib/actions/types";
import type { GuardrailConfig } from "@/lib/guardrails/config";
import type { ConformanceCase, Expected } from "@/lib/guardrails/conformance";
import { CONFORMANCE_SET } from "@/lib/guardrails/conformance";
import { checkGrounding } from "@/lib/guardrails/grounding";
import { fitsBudget } from "@/lib/guardrails/budget";
import { screenInput } from "@/lib/guardrails/input";
import { checkOutput } from "@/lib/guardrails/output";
import type { Collector } from "@/lib/trace/collector";

export type CaseResult = {
  id: string;
  criterion: string;
  expected: Expected;
  actual: Expected;
  passed: boolean;
  note: string;
};

/** Run one case and say how it ended, in the set's own vocabulary. */
export function runCase(
  entry: ConformanceCase,
  state: AppState,
  config?: GuardrailConfig,
): CaseResult {
  const actual = outcomeOf(entry, state, config);
  return {
    id: entry.id,
    criterion: entry.criterion,
    expected: entry.expected,
    actual,
    passed: actual === entry.expected,
    note: entry.note,
  };
}

function outcomeOf(
  entry: ConformanceCase,
  state: AppState,
  config?: GuardrailConfig,
): Expected {
  if (entry.where === "input") {
    const message = entry.message ?? "";
    // Budget first: an oversized message is refused before anything reads it,
    // which is the point of checking the size at all.
    if (fitsBudget({ message }).kind === "refuse") return "refused";

    const verdict = screenInput({ text: message, config });
    if (verdict.kind === "refuse") return "refused";
    if (verdict.kind === "redirect") return "redirected";
    return verdict.kind === "redact" ? "revised" : "allowed";
  }

  if (entry.where === "output") {
    const verdict = checkOutput({
      reply: entry.reply ?? "",
      toolResults: entry.actionSucceeded
        ? [{ action: "profile.addCourse", ok: true }]
        : entry.actionSucceeded === false
          ? [{ action: "profile.addCourse", ok: false }]
          : [],
      config,
    });
    return verdict.kind === "revise" ? "revised" : "allowed";
  }

  const verdict = checkGrounding({
    reply: entry.reply ?? "",
    state,
    userSaid: entry.userSaid,
    config,
  });
  return verdict.kind === "revise" ? "revised" : "allowed";
}

export type ConformanceReport = {
  results: CaseResult[];
  passed: number;
  failed: CaseResult[];
};

/**
 * Run the whole set.
 *
 * When a collector is given, each failure is recorded as a violation, so a
 * regression in a guard shows up in the same place the guards' live refusals
 * do rather than only in a test log somebody has to be looking at.
 */
export function runConformance({
  state,
  config,
  collector,
}: {
  state: AppState;
  config?: GuardrailConfig;
  collector?: Collector;
}): ConformanceReport {
  const results = CONFORMANCE_SET.map((entry) => runCase(entry, state, config));
  const failed = results.filter((result) => !result.passed);

  for (const result of failed) {
    collector?.violation({
      guard: "output",
      rule: `conformance:${result.criterion}`,
      severity: "flag",
      detail: `${result.id} expected ${result.expected}, got ${result.actual}`,
      sample: result.note,
    });
  }

  return { results, passed: results.length - failed.length, failed };
}
