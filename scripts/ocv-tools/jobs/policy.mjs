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
  return {
    lines: [`PR #${n} passes the server-held rules.`],
    next: `scripts/ocv-tools.mjs merge ${n}`,
  }
}
