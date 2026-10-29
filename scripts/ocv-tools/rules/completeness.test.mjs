import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { evaluate } from "./decide.mjs"
import { RULES } from "./table.mjs"

const text = (rel) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")

const root = fileURLToPath(new URL("..", import.meta.url))

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (name.endsWith(".mjs") && !name.endsWith(".test.mjs"))
      out.push(path)
  }
  return out
}

// ERROR is the fallback for a thrown Error, not a refusal a job raises.
const NOT_A_RULE = new Set(["ERROR"])

function raisedCodes() {
  const codes = new Set()
  const literal = /[Rr]efused\(\s*"([A-Z][A-Z0-9_]*)"/g
  for (const path of sources(root)) {
    const source = readFileSync(path, "utf8")
    for (const match of source.matchAll(literal)) codes.add(match[1])
    if (!path.endsWith(`${join("ocv-tools", "result.mjs")}`)) continue
    const start = source.indexOf("export const FIXES = {")
    const end = source.indexOf("\n}", start)
    const body = source.slice(start, end)
    for (const match of body.matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm))
      codes.add(match[1])
  }
  return codes
}

test("rule markers and hereFact stay private", () => {
  const doc = text("./doc.mjs")
  assert.doesNotMatch(doc, /export const BEGIN/)
  assert.doesNotMatch(doc, /export const END/)
  assert.match(doc, /const BEGIN =/)
  assert.match(doc, /const END =/)
  const claim = text("../claim.mjs")
  assert.doesNotMatch(claim, /export function hereFact/)
  assert.match(claim, /function hereFact/)
})

test("every raised refusal code has a row, and every row is raised", () => {
  const raised = raisedCodes()
  const ids = new Set(RULES.map((row) => row.id))
  const rulesSh = text("../../lib/rules.sh")
  for (const code of raised) {
    if (NOT_A_RULE.has(code)) continue
    assert.ok(ids.has(code), `${code} has no table row`)
  }
  for (const row of RULES) {
    if (row.kind === "judgment") continue
    if (raised.has(row.id)) continue
    if (row.impl?.startsWith("bash:")) {
      const name = row.impl.slice("bash:".length)
      assert.match(rulesSh, new RegExp(`^${name}\\(\\)`, "m"), row.id)
      continue
    }
    assert.fail(`${row.id} is not raised`)
  }
  for (const id of ["MISSING_FILE", "BAD_PICTURE", "TOO_BIG", "TOO_MANY"])
    assert.ok(RULES.find((row) => row.id === id).jobs.includes("shot"), id)
  const approval = RULES.find((row) => row.id === "NOT_HIGH_RISK")
  assert.ok(approval.jobs.includes("approve"))
  const owner = RULES.find((row) => row.id === "NOT_OWNER")
  assert.ok(owner.jobs.includes("release"))
  assert.ok(owner.jobs.includes("approve"))
  assert.match(owner.says, /release/)
  assert.match(owner.says, /approve/)
  const history = RULES.find((row) => row.id === "UNKNOWN")
  assert.ok(history.jobs.includes("board"))
  assert.ok(history.jobs.includes("shot"))
  assert.match(history.says, /board/)
})

test("shot, approve and board refusals keep their messages and fixes", () => {
  const hit = (id, facts) => evaluate(id, facts)
  assert.equal(
    hit("MISSING_FILE", { picture: { path: "shot.png", exists: false } })
      .message,
    "shot.png does not exist"
  )
  assert.equal(
    hit("BAD_PICTURE", { picture: { path: "notes", file: false } }).message,
    "notes is not a png, jpg, gif or webp"
  )
  assert.equal(
    hit("BAD_PICTURE", { picture: { asset: "issue-90-a.png" } }).fix,
    "Pass --name, or rename one file so the pictures stay distinct."
  )
  assert.equal(
    hit("TOO_BIG", { picture: { path: "big.png", bytes: 10 * 1024 * 1024 } }),
    null
  )
  assert.equal(
    hit("NOT_HIGH_RISK", { issue: { n: 90, risk: null } }).message,
    "#90 is unset risk, so no approval is needed"
  )
  assert.equal(
    hit("NOT_HIGH_RISK", { issue: { n: 90, risk: "low" } }).fix,
    "No approval is needed. Run: scripts/ocv-tools.mjs take 90"
  )
  const signed = hit("NOT_OWNER", {
    issue: { n: 90 },
    claim: { state: "none" },
    me: null,
    account: { login: "collaborator", owner: "owner" },
  })
  assert.equal(
    signed.message,
    "signed in as collaborator, but only owner can approve #90"
  )
  assert.equal(
    signed.fix,
    "run this as the owner account; take only accepts the owner's /approve"
  )
  assert.equal(
    hit("NOT_OWNER", {
      issue: { n: 90 },
      claim: { state: "none" },
      me: null,
      account: { login: "Owner", owner: "owner" },
    }),
    null
  )
  assert.equal(
    hit("UNKNOWN", { history: { kind: "board-stuck", list: "issue" } }).message,
    "the open issue list stopped before the last page (the page cursor did not move)"
  )
  assert.equal(
    hit("UNKNOWN", {
      history: { kind: "board-cap", list: "pull", pageCap: 40 },
    }).message,
    "the open pull request list is incomplete: 40 pages were read and more pull requests remain"
  )
  assert.equal(
    hit("UNKNOWN", { history: { kind: "comments-open", n: 12 } }).message,
    "claim history for #12 did not say whether more comments exist"
  )
  assert.equal(
    hit("UNKNOWN", { history: { kind: "comment-size" } }).fix,
    "Use a shorter --name. Run: scripts/ocv-tools.mjs help"
  )
  assert.equal(
    hit("NOT_AN_ISSUE", {
      issue: { n: 4, missing: true, kind: "pr", shot: true },
    }).fix,
    "Pass a pull request number to --pr. Run: gh pr list"
  )
  assert.equal(
    hit("BAD_ARGS", { args: { shot: true } }).message,
    "pass --pr or --issue, not both"
  )
})
