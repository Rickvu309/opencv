#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { appendFileSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const OWN = new Set([
  ".github/workflows/ci.yml",
  "scripts/tlc.mjs",
  "scripts/lib/tla-specs.mjs",
  "scripts/lib/ci-workflow.mjs",
])

const PR_EVENTS = new Set([
  "pull_request",
  "pull_request_target",
  "merge_group",
])

const REQUIRED = [
  [/^ {2}formal-tla:\s*$/m, "formal-tla job"],
  [/actions\/setup-java@v4/, "setup-java"],
  [/distribution: temurin/, "temurin 21"],
  [/java-version: ["']21["']/, "java 21"],
  [/releases\/download\/v1\.7\.4\/tla2tools\.jar/, "tla2tools 1.7.4"],
  [/sha256sum -c/, "sha256 check"],
  [/actions\/cache@v4/, "tla2tools cache"],
  [/JAVA_HOME:/, "JAVA_HOME"],
  [/TLA2TOOLS:/, "TLA2TOOLS"],
  [/node scripts\/tlc\.mjs --all/, "tlc --all"],
  [/node scripts\/lib\/ci-workflow\.mjs gate/, "model gate"],
  [
    /::notice title=POLICY::no pull request applies to the/,
    "policy skip notice",
  ],
  [
    /::error title=POLICY::no pull request number in the/,
    "policy failure when a pull request has no number",
  ],
]

export function namedModules(mapTexts) {
  const named = []
  for (const [mapPath, text] of Object.entries(mapTexts)) {
    let map
    try {
      map = JSON.parse(text)
    } catch {
      continue
    }
    if (typeof map?.module !== "string" || Object.hasOwn(map, "version"))
      continue
    named.push(
      path.posix.normalize(
        path.posix.join(path.posix.dirname(mapPath), map.module)
      )
    )
  }
  return named
}

export function modelChanges(changed, mapTexts) {
  const named = new Set(namedModules(mapTexts))
  const hits = []
  for (const file of changed) {
    if (hits.includes(file)) continue
    if (
      file.endsWith(".tla") ||
      file.endsWith(".cfg") ||
      file.endsWith(".tla.json") ||
      named.has(file) ||
      OWN.has(file)
    )
      hits.push(file)
  }
  return hits
}

export function policyChoice({ event, prNumber, queueRef }) {
  let number = String(prNumber ?? "")
  if (!number) {
    const found = /\/pr-([0-9]+)-/.exec(String(queueRef ?? ""))
    if (found) number = found[1]
  }
  if (number) return { kind: "run", number }
  if (PR_EVENTS.has(event)) return { kind: "fail", event }
  return { kind: "skip", event }
}

export function detect(text, file) {
  if (!String(file).endsWith(".github/workflows/ci.yml")) return []
  const hits = []
  for (const [pattern, name] of REQUIRED)
    if (!pattern.test(text)) hits.push(`${name} is missing`)
  const ciAt = text.search(/^ {2}ci:\s*$/m)
  const ci = ciAt === -1 ? "" : text.slice(ciAt)
  if (!/^ {4}needs:\s*\[[\s\S]*\bformal-tla\b/m.test(ci))
    hits.push("ci needs formal-tla")
  return hits
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" })
}

function changedFiles() {
  if (process.env.FORMAL_CHANGED != null)
    return process.env.FORMAL_CHANGED.split("\0").filter(Boolean)
  const base = process.env.FORMAL_BASE
  if (!base) throw new Error("FORMAL_BASE is not set")
  return git(["diff", "--name-only", "-z", base, "HEAD"])
    .split("\0")
    .filter(Boolean)
}

function mapTexts() {
  if (process.env.FORMAL_MAPS != null)
    return JSON.parse(process.env.FORMAL_MAPS)
  const out = {}
  for (const file of git(["ls-files", "-z", "*.tla.json"])
    .split("\0")
    .filter(Boolean))
    out[file] = readFileSync(file, "utf8")
  return out
}

function writeOutput(line) {
  const output = process.env.GITHUB_OUTPUT
  if (output) appendFileSync(output, line)
  else process.stdout.write(line)
}

function gate() {
  const hits = modelChanges(changedFiles(), mapTexts())
  writeOutput(hits.length ? "run=true\n" : "run=false\n")
  if (hits.length === 0)
    process.stdout.write(
      "No formal model file changed, so the model check is not needed.\n"
    )
}

function policyCli() {
  const choice = policyChoice({
    event: process.env.GITHUB_EVENT_NAME ?? "",
    prNumber: process.env.PR_NUMBER ?? "",
    queueRef: process.env.QUEUE_REF ?? "",
  })
  process.stdout.write(
    choice.kind === "run" ? `run:${choice.number}\n` : `${choice.kind}\n`
  )
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const cmd = process.argv[2]
  if (cmd === "gate") gate()
  else if (cmd === "policy") policyCli()
  else {
    process.stderr.write(
      "usage: node scripts/lib/ci-workflow.mjs <gate|policy>\n"
    )
    process.exitCode = 64
  }
}
