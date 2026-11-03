import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { RULES } from "../rules/index.mjs"
import { policyReport } from "./policy.mjs"

test("policy.mjs imports only node builtins and rules/", () => {
  const src = readFileSync(new URL("./policy.mjs", import.meta.url), "utf8")
  const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1])
  assert.ok(imports.length > 0)
  for (const from of imports)
    assert.ok(
      from.startsWith("node:") || from.startsWith("../rules/"),
      `policy.mjs imports ${from}`
    )
})

const clean = {
  pull: {
    issue: 90,
    title: "feat: keep my search (#90)",
    body: "Closes #90\n",
    issueState: "OPEN",
  },
  issue: { n: 90, labels: [] },
  diff: {
    files: ["source.mjs"],
    labels: [],
    deleted: { files: 0, lines: 0, total: 100 },
  },
  commits: { trailers: "", oversize: "" },
  pins: [],
}

test("a clean pull request passes with exit 0", () => {
  const r = policyReport(91, clean)
  assert.equal(r.exit ?? 0, 0)
  assert.match(r.lines[0], /passes the server-held rules/)
})

test("one line per refusal, exit 2, each with its fix", () => {
  const r = policyReport(91, {
    ...clean,
    pull: { ...clean.pull, title: "Keep my search" },
    diff: { ...clean.diff, files: [".github/workflows/extra.yml"] },
  })
  assert.equal(r.exit, 2)
  const metadata = r.lines.find((line) => line.startsWith("PR_METADATA:"))
  const workflows = r.lines.find((line) => line.startsWith("NO_WORKFLOWS:"))
  assert.ok(metadata, r.lines.join("\n"))
  assert.ok(workflows, r.lines.join("\n"))
  assert.match(metadata, /fix: Run gh pr edit/)
  assert.match(metadata, /scripts\/ocv-tools\.mjs body/)
  assert.doesNotMatch(metadata, /gh pr edit\b[^,.\n]*--body/)
  assert.match(workflows, /extra\.yml/)
})

test("the commit rows run at the pr moment", () => {
  const r = policyReport(91, {
    ...clean,
    commits: { trailers: "on branch", oversize: "big.mjs (30000 bytes) " },
  })
  assert.equal(r.exit, 2)
  assert.ok(r.lines.some((line) => line.startsWith("NO_AI_ATTRIBUTION:")))
  assert.ok(r.lines.some((line) => line.startsWith("FILE_SIZE:")))
})

test("in Actions each refusal is one error annotation with the rule id", () => {
  const r = policyReport(
    91,
    { ...clean, pull: { ...clean.pull, title: "Keep my search" } },
    { annotate: true }
  )
  assert.equal(r.exit, 2)
  const line = r.lines.find((l) => l.startsWith("::error title=PR_METADATA::"))
  assert.ok(line, r.lines.join("\n"))
  assert.match(line, /fix: Run gh pr edit/)
  assert.match(line, /scripts\/ocv-tools\.mjs body/)
  assert.doesNotMatch(line, /gh pr edit\b[^,.\n]*--body/)
  assert.ok(r.lines.every((l) => l.startsWith("::error title=")))
})

test("no rule fix teaches gh pr edit --body", () => {
  const taught = []
  for (const row of RULES) {
    let text = ""
    try {
      text = String(row.fix?.({}) ?? "")
    } catch {
      text = ""
    }
    if (/gh pr edit\b[^,.\n]*--body/.test(text)) taught.push(row.id)
  }
  assert.deepEqual(taught, [])
})

test("a clean pull request prints no annotation", () => {
  const r = policyReport(91, clean, { annotate: true })
  assert.equal(r.exit ?? 0, 0)
  assert.ok(r.lines.every((l) => !l.startsWith("::")))
})

test("policy refuses an expected failure whose issue this pull request closes", () => {
  const r = policyReport(91, {
    ...clean,
    pins: [{ at: "apps/api/src/a.test.ts:3", issue: 90, state: "OPEN" }],
  })
  assert.equal(r.exit, 2)
  const line = r.lines.find((l) => l.startsWith("PIN_ISSUE_OPEN:"))
  assert.ok(line, r.lines.join("\n"))
  assert.match(line, /a\.test\.ts:3 cites #90, which this pull request closes/)
})
