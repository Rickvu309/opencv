import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import ts from "typescript"
import { fileURLToPath } from "node:url"
import { evaluate, RULES } from "./index.mjs"

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

// These are forwarding sites, not independently raised codes. Fail closed on
// every other dynamic argument so a new construction cannot evade coverage.
const FORWARDING = new Set([
  "jobs/common.mjs:Refused:code", // Delivery boundary forwards its literal caller code.
  "jobs/common.mjs:evaluate:code", // Delivery precondition with its boundary message.
  "rules/index.mjs:Refused:refusal.id", // Converts a decide/evaluate result.
  "shot.mjs:evaluate:id", // refuse forwards its literal caller's id.
  "approve.mjs:evaluate:id", // Same wrapper as shot.
])

function raisedCodes(inputs, rows) {
  const codes = new Set()
  const jobs = new Set()
  for (const [path, source] of inputs) {
    if (!path.endsWith(".mjs") || path.endsWith(".test.mjs")) continue
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    function visit(node) {
      if (
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        ts.isIdentifier(node.expression) &&
        ["Refused", "refused", "refuse", "evaluate", "decide"].includes(
          node.expression.text
        )
      ) {
        const name = node.expression.text
        const arg = node.arguments?.[0]
        if (arg && ts.isStringLiteralLike(arg)) {
          const target = name === "decide" ? jobs : codes
          target.add(arg.text)
        } else {
          const site = `${path}:${name}:${arg?.getText(ast)}`
          if (site === "take.mjs:evaluate:row.id") {
            // decideTake evaluates checked rows for take lazily, in table order.
            jobs.add("take")
          } else if (site === "claim.mjs:decide:job") {
            // taskHere defaults to save; its other callers pass release/cleanup.
            // Only NOT_A_TASK is reachable with its sole fact { here }.
            codes.add("NOT_A_TASK")
          } else {
            assert.ok(FORWARDING.has(site), `unlisted dynamic refusal: ${site}`)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
  }
  for (const row of rows) {
    const moments = row.at
    if (row.check && moments.some((job) => jobs.has(job))) codes.add(row.id)
  }
  return codes
}

function checkCoverage(inputs, rows) {
  const raised = raisedCodes(inputs, rows)
  const ids = new Set(rows.map((row) => row.id))
  const gaps = []
  for (const code of raised) {
    if (!ids.has(code)) gaps.push(`${code} has no table row`)
  }
  for (const row of rows) {
    if (row.kind === "judgment" || raised.has(row.id)) continue
    gaps.push(`${row.id} is not raised`)
  }
  assert.deepEqual(gaps, [], gaps.join("\n"))
}

const inputs = () =>
  sources(root).map((path) => [
    relative(root, path),
    readFileSync(path, "utf8"),
  ])

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
  checkCoverage(inputs(), RULES)
  for (const id of ["MISSING_FILE", "BAD_PICTURE", "TOO_BIG", "TOO_MANY"])
    assert.ok(RULES.find((row) => row.id === id).at.includes("shot"), id)
  const approval = RULES.find((row) => row.id === "NOT_HIGH_RISK")
  assert.ok(approval.at.includes("approve"))
  const owner = RULES.find((row) => row.id === "NOT_OWNER")
  assert.ok(owner.at.includes("release"))
  assert.ok(owner.at.includes("approve"))
  assert.match(owner.says, /release/)
  assert.match(owner.says, /approve/)
  const history = RULES.find((row) => row.id === "UNKNOWN")
  assert.ok(history.at.includes("board"))
  assert.ok(history.at.includes("shot"))
  assert.match(history.says, /board/)
})

test("R105 allows exactly ci.yml and nightly.yml in the rule table", () => {
  for (const [name, allowed] of [
    ["ci.yml", true],
    ["nightly.yml", true],
    ["extra.yml", false],
    ["ci.yaml", false],
    ["nightly.yaml", false],
    ["nested/nightly.yml", false],
    ["nightly.yml.bak", false],
    ["ci.yml\n.github/workflows/extra.yml", false],
  ]) {
    const files = `.github/workflows/${name}`
    assert.equal(
      evaluate("NO_WORKFLOWS", { diff: { files } }) === null,
      allowed,
      name
    )
  }
})

test("nightly.yml requires risk:high in the rule table", () => {
  const files = ".github/workflows/nightly.yml"
  for (const labels of [[], ["risk:high"]]) {
    const allowed = labels.includes("risk:high")
    assert.equal(
      evaluate("RISK_HIGH_FOR_CI", { diff: { files, labels } }) === null,
      allowed
    )
  }
})

test("coverage rejects new calls without rows for every raising helper", () => {
  for (const call of [
    'new Refused("NEW_CODE_X", "bad")',
    "refused('NEW_CODE_X', 'bad')",
    'refuse("NEW_CODE_X", {})',
    'evaluate("NEW_CODE_X", {})',
  ]) {
    assert.throws(
      () => checkCoverage([["injected.mjs", call]], []),
      /NEW_CODE_X has no table row/
    )
  }
  assert.throws(
    () =>
      checkCoverage(
        [...inputs(), ["injected.mjs", 'refuse("NEW_CODE_X", {})']],
        RULES
      ),
    /NEW_CODE_X has no table row/
  )
})

test("coverage rejects dead rows, including codes only present in FIXES", () => {
  const row = { id: "DEAD_CODE_Y", kind: "precondition", at: ["unused"] }
  assert.throws(() => checkCoverage([], [row]), /DEAD_CODE_Y is not raised/)
  assert.throws(
    () =>
      checkCoverage(
        [
          [
            "result.mjs",
            [
              "export const FIXES = {",
              '  UNKNOWN_COMMAND: "Run: scripts/ocv-tools.mjs help",',
              "  DEAD_CODE_Y:",
              '    "Pick another issue. Run: gh issue list",',
              "}",
            ].join("\n"),
          ],
        ],
        [row]
      ),
    /DEAD_CODE_Y is not raised/
  )
  assert.throws(
    () => checkCoverage(inputs(), [...RULES, row]),
    /DEAD_CODE_Y is not raised/
  )
})

test("coverage ignores comments, prose, definitions and test sources", () => {
  checkCoverage(
    [
      [
        "data.mjs",
        `
      // refuse("COMMENT_CODE", {})
      /* new Refused("COMMENT_CODE", "bad") */
      const docs = 'evaluate("DOC_CODE", {})'
      const row = { id: "ROW_CODE" }
      function refuse(id, facts) {}
    `,
      ],
      ["ignored.test.mjs", 'refuse("TEST_CODE", {})'],
    ],
    []
  )
})

test("coverage follows decide jobs and refuses unknown dynamic calls", () => {
  const row = {
    id: "JOB_CODE",
    kind: "rule",
    at: ["save"],
    check: () => "bad",
  }
  checkCoverage([["job.mjs", 'decide("save", {})']], [row])
  assert.throws(
    () => checkCoverage([["job.mjs", 'decide("other", {})']], [row]),
    /JOB_CODE is not raised/
  )
  assert.throws(
    () => checkCoverage([["job.mjs", "refuse(prefix + suffix, {})"]], []),
    /unlisted dynamic refusal/
  )
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
    account: { login: "collaborator", approvers: ["owner"] },
  })
  assert.equal(
    signed.message,
    "signed in as collaborator, without admin rights to approve #90"
  )
  assert.equal(
    signed.fix,
    "run this as an account with admin rights on the project"
  )
  assert.equal(
    hit("NOT_OWNER", {
      issue: { n: 90 },
      claim: { state: "none" },
      me: null,
      account: { login: "Owner", approvers: ["owner"] },
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
