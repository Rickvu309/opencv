import { decide } from "../rules/index.mjs"

export function policyReport(n, facts, { annotate = false } = {}) {
  const verdict = decide("pr", facts)
  if (!verdict.ok)
    return {
      exit: 2,
      lines: verdict.refusals.map((refusal) =>
        annotate
          ? `::error title=${refusal.id}::${refusal.message} fix: ${refusal.fix}`
          : `${refusal.id}: ${refusal.message} fix: ${refusal.fix}`
      ),
      next: `gh pr view ${n}`,
    }
  const retired = facts.protected?.retired ?? []
  return {
    lines: [
      `PR #${n} passes the server-held rules.`,
      ...(retired.length
        ? [
            `It retires ${retired.length} protected check(s): ${retired
              .slice(0, 6)
              .map((item) => item.subject)
              .join("; ")}`,
          ]
        : []),
    ],
    next: `scripts/ocv-tools.mjs merge ${n}`,
  }
}
