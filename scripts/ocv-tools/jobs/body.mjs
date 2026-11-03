import { decide, refusalError } from "../rules/index.mjs"
import { closesIssue, issueInTitle, issueOfBranch } from "../rules/pull-ref.mjs"
import { gh, json } from "./common.mjs"
import { bodyOf } from "./finish.mjs"

function withClosingLine(text, n) {
  if (closesIssue(text, n)) return text
  return `Closes #${n}\n\n${text}`
}

export function replaceBody(ctx, n, { flags }) {
  const written = bodyOf(ctx, flags["--body-file"])
  const viewed = json(
    ctx,
    "pr",
    "view",
    String(n),
    "--json",
    "title,headRefName"
  )
  const title = viewed.title ?? ""
  const verdict = decide("body", { body: written, pull: { title } })
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
  const branch = viewed.headRefName ?? ""
  const issue = issueOfBranch(branch)
  if (issue == null)
    throw new Error(`PR #${n} branch "${branch}" is not type/<issue>-words.`)
  if (issueInTitle(title) !== issue)
    throw new Error(
      `PR #${n} branch ${branch} closes #${issue}, but the title does not end with (#${issue}).`
    )
  const text = withClosingLine(written.text, issue)
  const bodyFile = ctx.writeScratch(`body/${n}-body.md`, text)
  gh(ctx, "pr", "edit", String(n), "--body-file", bodyFile)
  return {
    lines: [`Updated the body of #${n}.`],
    next: `scripts/ocv-tools.mjs policy ${n}`,
  }
}
