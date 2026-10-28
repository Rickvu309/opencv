#!/usr/bin/env node
// Classifies one verify checker run for the PR review. The checker prints one `PASS|FAIL|STALE <id> [<kind>] <name>:
// <measured> | rule: <rule>` line per check. `known` is the skill's known-findings.json on origin/main.
//   PASS                  nothing to report
//   FAIL, listed          known, allowed
//   FAIL, not listed      new: fails the review
//   PASS, listed          fixed: fails the review until the entry is removed, so the list cannot rot
//   STALE                 fails the review
//   listed, not reported  gone: the check was removed or renamed; fails until the entry is removed
// A checker exit other than 0, 1 or 3, or a run with no check lines, is an error and fails the review.
//   node scripts/lib/verify-gate.mjs <checker log> <checker exit code> <known-findings.json or ->
// Prints one line per problem, `<STATE> <id> <name>: <measured, 160 chars>`, then `gate: ...`. Exits 0 with no problem, else 1.
import { existsSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const LINE = /^(PASS|FAIL|STALE) (\S+) (?:\[\w+\] )?(.*)$/
const SNIPPET = 160

export function parseKnown(text) {
  const list = text.trim() === "" ? [] : JSON.parse(text)
  if (!Array.isArray(list)) throw new Error("known-findings.json must be an array")
  const ids = new Set()
  for (const e of list) {
    if (typeof e?.id !== "string" || !Number.isInteger(e.issue) || typeof e.note !== "string" || typeof e.since !== "string")
      throw new Error(`known finding needs string id, integer issue, since and note: ${JSON.stringify(e)}`)
    if (ids.has(e.id)) throw new Error(`known finding ${e.id} is listed twice`)
    ids.add(e.id)
  }
  return list
}

export function parseChecks(text) {
  const checks = []
  for (const raw of text.split("\n")) {
    const m = LINE.exec(raw.trimEnd())
    if (!m) continue
    const rest = m[3]
    const colon = rest.indexOf(": ")
    const measured = (colon < 0 ? rest : rest.slice(colon + 2)).split(" | rule:")[0]
    checks.push({ id: m[2], name: colon < 0 ? "" : rest.slice(0, colon), status: m[1], measured })
  }
  return checks
}

export function classify({ output, exit, known }) {
  const problems = []
  const tail = output.trim().split("\n").slice(-3).join(" / ")
  if (![0, 1, 3].includes(exit)) {
    problems.push({ state: "ERROR", id: "-", text: `checker exited ${exit}: ${tail}`.slice(0, SNIPPET) })
    return { problems, counts: {} }
  }
  const checks = parseChecks(output)
  if (checks.length === 0) {
    problems.push({ state: "ERROR", id: "-", text: `checker printed no check lines (exit ${exit}): ${tail}`.slice(0, SNIPPET) })
    return { problems, counts: {} }
  }
  const listed = new Set(known.map((e) => e.id))
  const counts = { pass: 0, known: 0, new: 0, fixed: 0, stale: 0, gone: 0 }
  const seen = new Set()
  for (const c of checks) {
    seen.add(c.id)
    const text = c.measured.slice(0, SNIPPET)
    if (c.status === "STALE") {
      counts.stale++
      problems.push({ state: "STALE", id: c.id, name: c.name, text })
    } else if (c.status === "FAIL") {
      if (listed.has(c.id)) counts.known++
      else {
        counts.new++
        problems.push({ state: "NEW FAIL", id: c.id, name: c.name, text })
      }
    } else if (listed.has(c.id)) {
      counts.fixed++
      problems.push({ state: "FIXED, still listed in known-findings.json", id: c.id, name: c.name, text })
    } else counts.pass++
  }
  for (const id of listed) {
    if (seen.has(id)) continue
    counts.gone++
    problems.push({ state: "LISTED, not reported by the checker", id, text: "remove the entry from known-findings.json" })
  }
  return { problems, counts }
}

export function main(argv) {
  const [log, exitText, knownPath] = argv
  const exit = Number(exitText)
  if (!log || !Number.isInteger(exit) || !knownPath) {
    console.error("usage: verify-gate.mjs <checker log> <checker exit code> <known-findings.json or ->")
    return 2
  }
  let known, output
  try {
    known = knownPath === "-" || !existsSync(knownPath) ? [] : parseKnown(readFileSync(knownPath, "utf8"))
    output = readFileSync(log, "utf8")
  } catch (error) {
    console.log(`ERROR -: ${error.message}`.slice(0, 220))
    return 1
  }
  const { problems, counts } = classify({ output, exit, known })
  for (const p of problems) console.log(`${p.state} ${p.id}${p.name ? ` ${p.name}` : ""}: ${p.text}`)
  const summary = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ")
  console.log(`gate: ${problems.length === 0 ? "pass" : `${problems.length} problem(s)`}${summary ? ` (${summary})` : ""}`)
  return problems.length === 0 ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)))
