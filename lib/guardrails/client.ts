"use client";

/**
 * Reporting what the browser's guards caught.
 *
 * A guard that refuses silently cannot be measured, and the blueprint asks for
 * the guards' own accuracy to be measured rather than assumed: the false
 * positives only become visible if the refusals are counted.
 *
 * Fire and forget, like every other emission to the sink. A guard's decision
 * never depends on whether it was possible to write it down.
 */

import type { InputFinding } from "@/lib/guardrails/input";

/**
 * Anything a guard objected to.
 *
 * Structural rather than a union of the guards' own finding types: the output
 * guard and the grounding guard name different rules and both report here, and
 * a union would have to grow every time a guard learns a new one.
 */
type Reportable = { rule: string; detail: string; sample?: string };

type Severity = "block" | "revise" | "flag";

async function post(body: unknown): Promise<void> {
  try {
    await fetch("/api/guardrails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Deliberately silent.
  }
}

export function reportInputFindings(
  findings: InputFinding[],
  traceId: string | null,
): void {
  if (findings.length === 0) return;
  void post({
    guard: "input",
    traceId,
    findings: findings.map((finding) => ({
      rule: finding.rule,
      // An out-of-scope request is redirected, not stopped: the user gets a
      // real answer, just not the one they asked for. Calling that a block
      // would overstate what happened every time somebody asks about tax.
      severity: (finding.rule === "out-of-scope"
        ? "flag"
        : finding.rule === "sensitive-data"
          ? "revise"
          : "block") satisfies Severity,
      detail: finding.detail,
      sample: finding.sample,
    })),
  });
}

export function reportOutputFindings(
  findings: Reportable[],
  traceId: string | null,
  revised: boolean,
): void {
  if (findings.length === 0) return;
  void post({
    guard: "output",
    traceId,
    findings: findings.map((finding) => ({
      rule: finding.rule,
      severity: (revised ? "revise" : "flag") satisfies Severity,
      detail: finding.detail,
      sample: finding.sample,
    })),
  });
}
