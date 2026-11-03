import { resolve } from "node:path"
import { decide, refusalError } from "../rules/index.mjs"
import { gh, json } from "./common.mjs"

function readBody(ctx, flag) {
  if (!flag || flag === true) return { file: null, text: "" }
  const file = resolve(ctx.cwd, flag)
  try {
    return { file, text: ctx.readFile(file) }
  } catch {
    return { file, text: "", unreadable: true }
  }
}

function issueFromTitle(title) {
  const found = /\(#(\d+)\)\s*$/.exec(title ?? "")
  return found ? Number(found[1]) : null
}

function issueFromBody(text) {
  const found = /(?:^|\s)Closes #(\d+)(?:\D|$)/.exec(text ?? "")
  return found ? Number(found[1]) : null
}

function hasClosingLine(text, n) {
  return new RegExp(`(?:^|\\s)Closes #${n}(?:\\D|$)`).test(text)
}

function withClosingLine(text, n) {
  if (hasClosingLine(text, n)) return text
  return `Closes #${n}\n\n${text}`
}

export function replaceBody(ctx, n, { flags }) {
  const written = readBody(ctx, flags["--body-file"])
  const viewed = json(ctx, "pr", "view", String(n), "--json", "title,body")
  const title = viewed.title ?? ""
  const verdict = decide("body", { body: written, pull: { title } })
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
  const issue = issueFromTitle(title) ?? issueFromBody(viewed.body ?? "")
  if (issue == null)
    throw new Error(
      `PR #${n} has no "(#issue)" at the end of its title and no "Closes #issue" line in its body.`
    )
  const text = withClosingLine(written.text, issue)
  const bodyFile = ctx.writeScratch(`body/${n}-body.md`, text)
  gh(ctx, "pr", "edit", String(n), "--body-file", bodyFile)
  return {
    lines: [`Updated the body of #${n}.`],
    next: `scripts/ocv-tools.mjs policy ${n}`,
  }
}
