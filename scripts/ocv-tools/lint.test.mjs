import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { EXAMPLES, exampleIssues } from "./issue.mjs"
import {
  buildIssueBody,
  issueFieldProblems,
  lintIssue,
  parseRisk,
  readingGrade,
} from "./lint.mjs"

const base = {
  type: "feat",
  what: "The page forgets your search. This keeps it.",
  done: "- I search, leave, and come back. The box still has my words.",
  risk: "low",
}
const lint = (over = {}, title = "feat: Keep my search") =>
  lintIssue({ title, body: buildIssueBody({ ...base, ...over }) })

test("the model issues pass the lint", () => {
  const models = exampleIssues(readFileSync(EXAMPLES, "utf8"))
  assert.equal(models.length, 2)
  for (const m of models) {
    const result = lintIssue(m)
    assert.deepEqual(result.reasons, [], m.title)
    assert.ok(result.grade <= 8)
  }
})

test("a plain issue passes", () => {
  assert.deepEqual(lint().reasons, [])
})

test("jargon is advice and refuses nothing", () => {
  const result = lint({ what: "Add an API endpoint for search." })
  assert.match(result.advice.join(), /jargon word "api"/)
  assert.deepEqual(result.reasons, [])
  assert.equal(result.ok, true)
})

test("a title may use the everyday words and the body may not", () => {
  assert.deepEqual(lint({}, "fix: CI PR and API stay").advice, [])
  assert.deepEqual(lint({}, "fix: PRs and APIs stay").advice, [])
  for (const word of ["CI", "PR", "API"]) {
    assert.match(
      lint({ what: `The ${word} broke the page.` }).advice.join("\n"),
      new RegExp(`jargon word "${word.toLowerCase()}"`)
    )
  }
  assert.match(
    lint({}, "feat: Add an endpoint").advice.join("\n"),
    /jargon word "endpoint"/
  )
})

test("backticks and file names are refused outside Details for the agent", () => {
  assert.ok(lint({ what: "Change `search` please." }).failed.includes("code"))
  assert.ok(
    lint({ what: "Edit the page in jobs.tsx." }).failed.includes("paths")
  )
  assert.deepEqual(
    lint({ details: "Edit `apps/web/jobs.tsx` and the API." }).reasons,
    []
  )
})

test("a sentence over 20 words is advice and refuses nothing", () => {
  const long = Array.from({ length: 22 }, () => "word").join(" ") + "."
  const result = lint({ what: long })
  assert.ok(result.failed.includes("long-sentence"))
  assert.match(result.advice.join(), /22-word sentence/)
  assert.deepEqual(result.reasons, [])
})

test("more than 6 Done when lines is refused", () => {
  const done = Array.from({ length: 7 }, (_, i) => `- I see item ${i}.`).join(
    "\n"
  )
  assert.ok(lint({ done }).failed.includes("done-count"))
  assert.ok(
    !lint({ done: done.split("\n").slice(0, 6).join("\n") }).failed.includes(
      "done-count"
    )
  )
})

test("a vague Done when line is refused", () => {
  assert.ok(
    lint({ done: "- The page is better." }).failed.includes("done-vague")
  )
})

test("reading grade above 8 is advice and refuses nothing", () => {
  const hard =
    "Notwithstanding organizational considerations, comprehensive architectural reconsideration necessitates multidimensional stakeholder communication."
  const result = lint({ what: hard })
  assert.ok(result.grade > 8)
  assert.ok(result.failed.includes("reading-level"))
  assert.match(result.advice.join(), /read at grade/)
  assert.deepEqual(result.reasons, [])
  assert.ok(readingGrade("The cat sat on the mat.") < 3)
})

test("high risk needs What could go wrong", () => {
  assert.throws(
    () => buildIssueBody({ ...base, risk: "high" }),
    /--could-go-wrong/
  )
  const body = buildIssueBody({
    ...base,
    risk: "high",
    "could-go-wrong": "People could be locked out.",
  })
  assert.equal(parseRisk(body), "high")
  assert.deepEqual(
    lintIssue({ title: "feat: Keep my search", body }).reasons,
    []
  )
})

test("a hand body that lacks sections is reported", () => {
  const result = lintIssue({ title: "feat: x", body: "### Risk\n\nlow\n" })
  assert.match(result.reasons.join(), /missing the "done when" section/)
})

test("a bad risk or missing required field throws a plain message", () => {
  assert.throws(
    () => buildIssueBody({ ...base, risk: "huge" }),
    /--risk must be low, normal, high/
  )
  assert.throws(() => buildIssueBody({ ...base, done: "" }), /missing --done/)
})

test("every field problem is reported together", () => {
  assert.deepEqual(
    issueFieldProblems({ type: "feat", risk: "huge", what: "" }),
    ["missing --what, --done", '--risk must be low, normal, high, not "huge"']
  )
  assert.deepEqual(issueFieldProblems({ type: "feat", risk: "high" }), [
    "missing --what, --done",
    "missing --could-go-wrong (required when risk is high)",
  ])
  assert.deepEqual(issueFieldProblems(base), [])
})

test("jargon matches plurals and other word forms", () => {
  const body = `### Type\n\nfeat\n\n### What and why\n\nVisitors get faster APIs.\n\n### Done when\n\n- A visitor sees a page.\n\n### Risk\n\nlow\n`
  assert.ok(
    lintIssue({ title: "feat: x", body }).advice.some((r) => /jargon/.test(r))
  )
})

test("text before the first heading is linted", () => {
  const body = `\`scripts/x.mjs\` api worktree\n\n### What and why\n\nA visitor sees a page.\n\n### Done when\n\n- A visitor sees a page.\n\n### Risk\n\nlow\n`
  assert.ok(lintIssue({ title: "feat: x", body }).reasons.length > 0)
})

test("an empty required section is refused", () => {
  const body = `### What and why\n\n\n### Done when\n\n- A visitor sees a page.\n\n### Risk\n\nlow\n`
  assert.ok(
    lintIssue({ title: "feat: x", body }).reasons.some((r) => /empty/.test(r))
  )
})
