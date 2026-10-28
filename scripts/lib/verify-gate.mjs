#!/usr/bin/env node
// Classifies one verify checker run for the PR review. The checker prints one `PASS|FAIL|STALE <id> [<kind>] <name>:
// <measured> | rule: <rule>` line per check. `known` is the skill's known-findings.json on origin/main.
//   PASS                  nothing to report
//   FAIL, listed          known, allowed
//   FAIL, not listed      new: fails the review
//   PASS, listed          fixed: fails the review until the entry is removed, so the list cannot rot
//   STALE                 fails the review
//   listed, not reported  gone: the check was removed or renamed; fails until the entry is removed
//   advisory               a check whose id and name are both in ADVISORY: run and printed as an `ADVISORY` line, never gates, whatever its status
//   expected, not reported an invariant id in main's kinds.mjs (and still in the PR's) that the run did not report: MISSING
// A checker exit other than 0, 1 or 3 (a timeout is 124), or a run with no check lines, is an error and fails the review.
// A NEW FAIL is retried by the caller: given a second run, it counts only when it is a NEW FAIL in both runs. Any other
// problem counts if either run has it. A NEW FAIL in one run only is flaky: printed as a `FLAKY` line, never a failure.
//   node scripts/lib/verify-gate.mjs check --log L --exit N --known K.json [--expect E.json] [--log2 L2 --exit2 N2]
//   node scripts/lib/verify-gate.mjs list <main known.json> <PR known.json> <allowed out.json>
//   node scripts/lib/verify-gate.mjs expect <main kinds.mjs> <PR kinds.mjs> <expected out.json>
// check prints one line per problem, `<STATE> <id> <name>: <measured, 160 chars>`, then `gate: ...`. Exits 0 with no problem, else 1.
// list writes main's entries that the PR still has (a PR can only shrink the list) and prints `ADDED <id>` for each
// entry only the PR has. expect writes the invariant ids both copies of kinds.mjs list. A missing file reads as empty.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const LINE = /^(PASS|FAIL|STALE) (\S+) (?:\[\w+\] )?(.*)$/
const SNIPPET = 160
// Checks that print but never gate the review: their value depends on timing on a shared dev server (cold Vite compile,
// load from other reviews), which is not a reliable gate. Keyed by check name; renaming one makes it gate again.
// Keyed by id and name together, so renaming another check to an advisory name does not make it advisory.
export const ADVISORY = new Set(["34:first-render-budget"])

export function parseKnown(text) {
  const list = text.trim() === "" ? [] : JSON.parse(text)
  if (!Array.isArray(list))
    throw new Error("known-findings.json must be an array")
  const ids = new Set()
  for (const e of list) {
    if (
      typeof e?.id !== "string" ||
      !Number.isInteger(e.issue) ||
      typeof e.note !== "string" ||
      typeof e.since !== "string"
    )
      throw new Error(
        `known finding needs string id, integer issue, since and note: ${JSON.stringify(e)}`
      )
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
    const measured = (colon < 0 ? rest : rest.slice(colon + 2)).split(
      " | rule:"
    )[0]
    checks.push({
      id: m[2],
      name: colon < 0 ? "" : rest.slice(0, colon),
      status: m[1],
      measured,
    })
  }
  return checks
}

export function classify({ output, exit, known, expected = [] }) {
  const problems = []
  const tail = output.trim().split("\n").slice(-3).join(" / ")
  if (![0, 1, 3].includes(exit)) {
    const what = exit === 124 ? "timed out" : `exited ${exit}`
    problems.push({
      state: "ERROR",
      id: "-",
      text: `checker ${what}: ${tail}`.slice(0, SNIPPET),
    })
    return { problems, counts: {} }
  }
  const checks = parseChecks(output)
  if (checks.length === 0) {
    problems.push({
      state: "ERROR",
      id: "-",
      text: `checker printed no check lines (exit ${exit}): ${tail}`.slice(
        0,
        SNIPPET
      ),
    })
    return { problems, counts: {} }
  }
  const listed = new Set(known.map((e) => e.id))
  const counts = {
    pass: 0,
    known: 0,
    new: 0,
    fixed: 0,
    stale: 0,
    gone: 0,
    missing: 0,
    advisory: 0,
  }
  const seen = new Set()
  const advisory = []
  for (const c of checks) {
    seen.add(c.id)
    const text = c.measured.slice(0, SNIPPET)
    if (ADVISORY.has(`${c.id}:${c.name}`)) {
      if (c.status === "PASS") counts.pass++
      else {
        counts.advisory++
        advisory.push({
          state: "ADVISORY",
          id: c.id,
          name: c.name,
          text: `${c.status}, not gating: ${text}`,
        })
      }
    } else if (c.status === "STALE") {
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
      problems.push({
        state: "FIXED, still listed in known-findings.json",
        id: c.id,
        name: c.name,
        text,
      })
    } else counts.pass++
  }
  for (const id of listed) {
    if (seen.has(id)) continue
    counts.gone++
    problems.push({
      state: "LISTED, not reported by the checker",
      id,
      text: "remove the entry from known-findings.json",
    })
  }
  for (const id of expected) {
    if (seen.has(id) || listed.has(id)) continue
    counts.missing++
    problems.push({
      state: "MISSING",
      id,
      text: "the checker did not report this invariant check",
    })
  }
  return { problems, advisory, counts }
}

const isNew = (p) => p.state === "NEW FAIL"
export function combineRuns(first, second) {
  const again = new Map(second.problems.filter(isNew).map((p) => [p.id, p]))
  const before = new Set(first.problems.filter(isNew).map((p) => p.id))
  const seen = new Set()
  const problems = []
  for (const p of [...first.problems, ...second.problems]) {
    const key = `${p.state}\0${p.id}`
    if (isNew(p) || seen.has(key)) continue
    seen.add(key)
    problems.push(p)
  }
  const flaky = []
  for (const p of first.problems.filter(isNew)) {
    const q = again.get(p.id)
    if (q) problems.push({ ...q, text: `${q.text} | run 1: ${p.text}` })
    else
      flaky.push({
        state: "FLAKY",
        id: p.id,
        name: p.name,
        text: `NEW FAIL in run 1 only, so not counted: ${p.text}`,
      })
  }
  for (const q of again.values())
    if (!before.has(q.id))
      flaky.push({
        state: "FLAKY",
        id: q.id,
        name: q.name,
        text: `NEW FAIL in run 2 only, so not counted: ${q.text}`,
      })
  const counts = Object.keys(second.counts).length
    ? second.counts
    : first.counts
  return {
    problems,
    flaky,
    advisory: [...(first.advisory ?? []), ...(second.advisory ?? [])],
    counts,
  }
}

export function allowedList(main, pr) {
  const mainIds = new Set(main.map((e) => e.id))
  const prIds = new Set(pr.map((e) => e.id))
  return {
    allowed: main.filter((e) => prIds.has(e.id)),
    added: pr.filter((e) => !mainIds.has(e.id)).map((e) => e.id),
  }
}

export function invariantIds(kindsText) {
  return [...kindsText.matchAll(/^\s*"?([\w]+)"?\s*:\s*"invariant"/gm)].map(
    (m) => m[1]
  )
}

const readText = (path) =>
  path && path !== "-" && existsSync(path) ? readFileSync(path, "utf8") : ""

function flags(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2)
    out[argv[i].replace(/^--/, "")] = argv[i + 1]
  return out
}

function checkCommand(argv) {
  const f = flags(argv)
  const exit = Number(f.exit)
  const exit2 = f.log2 === undefined ? undefined : Number(f.exit2)
  if (
    !f.log ||
    !Number.isInteger(exit) ||
    !f.known ||
    (f.log2 !== undefined && !Number.isInteger(exit2))
  ) {
    console.error(
      "usage: verify-gate.mjs check --log L --exit N --known K.json [--expect E.json] [--log2 L2 --exit2 N2]"
    )
    return 2
  }
  let known, expected, output, output2
  try {
    known = parseKnown(readText(f.known))
    expected =
      readText(f.expect).trim() === "" ? [] : JSON.parse(readText(f.expect))
    output = readFileSync(f.log, "utf8")
    if (f.log2 !== undefined) output2 = readFileSync(f.log2, "utf8")
  } catch (error) {
    console.log(`ERROR -: ${error.message}`.slice(0, 220))
    return 1
  }
  let result = classify({ output, exit, known, expected })
  let flaky = []
  if (output2 !== undefined)
    ({
      problems: result.problems,
      flaky,
      advisory: result.advisory,
      counts: result.counts,
    } = combineRuns(
      result,
      classify({ output: output2, exit: exit2, known, expected })
    ))
  const { problems, counts } = result
  for (const p of [...problems, ...flaky, ...(result.advisory ?? [])])
    console.log(`${p.state} ${p.id}${p.name ? ` ${p.name}` : ""}: ${p.text}`)
  if (flaky.length) counts.flaky = flaky.length
  const summary = Object.entries(counts)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ")
  console.log(
    `gate: ${problems.length === 0 ? "pass" : `${problems.length} problem(s)`}${summary ? ` (${summary})` : ""}`
  )
  return problems.length === 0 ? 0 : 1
}

function listCommand([mainPath, prPath, outPath]) {
  if (!outPath) {
    console.error(
      "usage: verify-gate.mjs list <main known.json> <PR known.json> <allowed out.json>"
    )
    return 2
  }
  try {
    const { allowed, added } = allowedList(
      parseKnown(readText(mainPath)),
      parseKnown(readText(prPath))
    )
    writeFileSync(outPath, JSON.stringify(allowed))
    for (const id of added) console.log(`ADDED ${id}`)
    return 0
  } catch (error) {
    console.log(`ERROR -: ${error.message}`.slice(0, 220))
    return 1
  }
}

function expectCommand([mainPath, prPath, outPath]) {
  if (!outPath) {
    console.error(
      "usage: verify-gate.mjs expect <main kinds.mjs> <PR kinds.mjs> <expected out.json>"
    )
    return 2
  }
  const prIds = new Set(invariantIds(readText(prPath)))
  writeFileSync(
    outPath,
    JSON.stringify(
      invariantIds(readText(mainPath)).filter((id) => prIds.has(id))
    )
  )
  return 0
}

export function main(argv) {
  const [command, ...rest] = argv
  if (command === "check") return checkCommand(rest)
  if (command === "list") return listCommand(rest)
  if (command === "expect") return expectCommand(rest)
  console.error("usage: verify-gate.mjs check|list|expect ...")
  return 2
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  process.exit(main(process.argv.slice(2)))
