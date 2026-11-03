import { run, git } from "./common.mjs"
import {
  TEST_SOURCE,
  VITEST_TREES,
  citations,
} from "../../lib/expected-failure-issues.mjs"

const EXPECTED_FAILURE = "\\b(it|test|describe)\\.fails\\b"
const ISSUE_CONSTANT = "issue:[[:space:]]*[\"'`]#[0-9]+"

function grepTests(ctx, head, pattern) {
  const r = run(ctx, "git", [
    "grep",
    "-l",
    "-E",
    pattern,
    head,
    "--",
    ...VITEST_TREES,
  ])
  const noMatch = !r.ok && !r.out && !r.err
  if (noMatch) return []
  if (!r.ok) throw new Error(`git grep failed: ${r.err || r.out}`)
  return r.out
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(head.length + 1))
    .filter((path) => TEST_SOURCE.test(path))
}

function issueState(ctx, n) {
  const r = run(ctx, "gh", ["issue", "view", String(n), "--json", "state"])
  if (!r.ok) return "MISSING"
  return JSON.parse(r.out).state ?? "MISSING"
}

export function pinFacts(ctx, head) {
  const pinned = grepTests(ctx, head, EXPECTED_FAILURE)
  if (!pinned.length) return []
  const sources = new Map()
  for (const path of new Set([
    ...pinned,
    ...grepTests(ctx, head, ISSUE_CONSTANT),
  ]))
    sources.set(path, git(ctx, "show", `${head}:${path}`))
  const definitions = [...sources.values()].join("\n")
  const pins = []
  const states = new Map()
  for (const path of pinned)
    for (const { at, issues } of citations(
      sources.get(path),
      path,
      definitions
    )) {
      if (!issues.length) pins.push({ at, issue: null, state: null })
      for (const issue of issues) {
        if (!states.has(issue)) states.set(issue, issueState(ctx, issue))
        pins.push({ at, issue, state: states.get(issue) })
      }
    }
  return pins
}
