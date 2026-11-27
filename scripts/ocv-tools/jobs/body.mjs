import { decide, refusalError } from "../rules/index.mjs"
import { issueInTitle, issueOfBranch } from "../rules/pull-ref.mjs"
import { gh } from "./common.mjs"
import { bodyOf, withClosingLine } from "./finish.mjs"
import { pullFacts } from "./pull-facts.mjs"

export function replaceBody(ctx, n, { flags }) {
  const written = bodyOf(ctx, flags["--body-file"])
  const live = pullFacts(ctx, n)
  const title = live.pull.title ?? ""
  const branch = live.pull.branch ?? ""
  const issue = issueOfBranch(branch)
  const text =
    issue == null ? written.text : withClosingLine(written.text, issue)
  const facts = {
    ...live,
    body: { ...written, text },
    pull: { ...live.pull, title, body: text },
  }
  const verdict = decide("body", facts)
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
  if (issue == null)
    throw new Error(`PR #${n} branch "${branch}" is not type/<issue>-words.`)
  if (issueInTitle(title) !== issue)
    throw new Error(
      `PR #${n} branch ${branch} closes #${issue}, but the title does not end with (#${issue}).`
    )
  const still = decide("pr", facts).refusals.map(
    (refusal) =>
      `The policy check will still refuse ${refusal.id}: ${refusal.message}`
  )
  const bodyFile = ctx.writeScratch(`body/${n}-body.md`, text)
  gh(ctx, "pr", "edit", String(n), "--body-file", bodyFile)
  return {
    lines: [`Updated the body of #${n}.`, ...still],
    next: `scripts/ocv-tools.mjs policy ${n}`,
  }
}
