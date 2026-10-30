// ocv-tools policy <pr>: the pr-moment rows against a live pull request. CI
// runs the same evaluation as its policy job, so keep imports to node:
// builtins and rules/; the cli gathers the facts.
import { decide } from "../rules/index.mjs"

export function policyReport(n, facts) {
  const verdict = decide("pr", facts)
  if (!verdict.ok)
    return {
      exit: 2,
      lines: verdict.refusals.map(
        (refusal) => `${refusal.id}: ${refusal.message} fix: ${refusal.fix}`
      ),
      next: `gh pr view ${n}`,
    }
  return {
    lines: [`PR #${n} passes the server-held rules.`],
    next: `scripts/ocv-tools.mjs merge ${n}`,
  }
}
