import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { RUNS_FILE } from "./ci-screens.mjs"
import { expiredPending } from "./pending-fixes.mjs"

export const root = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../.."
)

const WEB_SRC = "apps/web/src"
export const COVERAGE_TEST = `${WEB_SRC}/test/design-frame-coverage.test.ts`
export const MANIFEST = `${WEB_SRC}/test/design-frames.json`
export const LAYOUT_PENDING = `${WEB_SRC}/test/design-frames.layout-pending.json`
export const COUNT_FILE = `${WEB_SRC}/test/design-frames.pending-count.json`
const SKIPS = "scripts/ci-screens.skips.json"
const DEFAULT_SCREEN_SCRIPT = "verify-pen-layout.mjs"
const TEST_FILE = /\.test\.tsx?$/
const SIGNED_IN_FRAME = /^W\d/

const LISTS = Object.freeze({
  pendingFrames: `PENDING_FRAMES in ${COVERAGE_TEST}`,
  layoutPending: LAYOUT_PENDING,
})

export function pendingFramesIn(text) {
  const block = /const PENDING_FRAMES\b[^=]*=\s*\{([\s\S]*?)\n\}/.exec(text)
  if (!block) return []
  return [...block[1].matchAll(/^\s*"?([\w-]+)"?\s*:\s*\{([^}]*)\}/gm)].map(
    ([, id, body]) => ({
      id,
      issue: Number(/\bissue\s*:\s*(\d+)/.exec(body)?.[1]) || null,
      expires: /\bexpires\s*:\s*"([^"]*)"/.exec(body)?.[1] ?? null,
    })
  )
}

export function countProblems(counts, pinned) {
  return Object.entries(counts).flatMap(([key, count]) => {
    const allowed = pinned[key]
    if (typeof allowed !== "number")
      return [`${COUNT_FILE} has no "${key}" count. Pin it at ${count}.`]
    if (count > allowed)
      return [
        `${LISTS[key]} has ${count} entries but ${COUNT_FILE} allows ${allowed}. The list only shrinks: build the frame's layout check instead of adding a pending entry.`,
      ]
    if (count < allowed)
      return [
        `${LISTS[key]} shrank to ${count} entries. Lower "${key}" in ${COUNT_FILE} from ${allowed} to ${count} in the same commit, so the freed slot cannot be reused.`,
      ]
    return []
  })
}

export function readPinned(read = (file) => readRepoFile(file)) {
  const text = read(COUNT_FILE)
  return text === null ? {} : JSON.parse(text)
}

export function detect(text, _file, pinned = readPinned()) {
  return countProblems(
    { pendingFrames: pendingFramesIn(text).length },
    { pendingFrames: pinned.pendingFrames }
  )
}

export function entryProblems({ list, entries, frameIds, today }) {
  const problems = []
  const seen = new Set()
  for (const entry of entries) {
    const where = `${LISTS[list]}: ${entry.id}`
    if (seen.has(entry.id)) problems.push(`${where} is listed twice.`)
    seen.add(entry.id)
    if (!frameIds.has(entry.id))
      problems.push(`${where} is not a release frame in ${MANIFEST}.`)
    if (!Number.isInteger(entry.issue) || entry.issue <= 0)
      problems.push(`${where} names no issue.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? ""))
      problems.push(`${where} has no expiry date (YYYY-MM-DD).`)
  }
  for (const entry of expiredPending(
    entries.filter((entry) => entry.expires),
    today
  ))
    problems.push(
      `${LISTS[list]}: ${entry.id} expired on ${entry.expires}. Build its layout check (#${entry.issue}) and delete the entry.`
    )
  return problems
}

export function screenRuns(text) {
  if (!text) return []
  return JSON.parse(text).map((run) => ({
    id: run.id,
    script: run.script,
    extra: run.extra ?? [],
  }))
}

const scriptName = (script) => path.basename(script).replace(/\.mjs$/, "")

export function driverRun(driver, runs) {
  const [script = DEFAULT_SCREEN_SCRIPT, ...args] = (driver ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return (
    runs.find(
      (run) =>
        scriptName(run.script) === scriptName(script) &&
        run.extra.join(" ") === args.join(" ")
    ) ?? null
  )
}

export function layoutCheck(layout, { imported, runs, skipped }) {
  if (imported.has(layout.file)) return `a test imports ${layout.file}`
  const run = driverRun(layout.driver, runs)
  if (
    run &&
    !skipped.has(run.id) &&
    !skipped.has(`${run.id}:${layout.frameId}`)
  )
    return `the screens job runs ${run.id} on ${layout.file}`
  return null
}

export function frameProblems({
  frames,
  pending,
  layoutPending,
  layouts,
  checks,
}) {
  const checked = new Map()
  for (const layout of layouts) {
    const how = layoutCheck(layout, checks)
    if (how && !checked.has(layout.frameId)) checked.set(layout.frameId, how)
  }
  const waiting = new Set(pending.map((entry) => entry.id))
  const problems = []
  for (const entry of layoutPending) {
    if (waiting.has(entry.id))
      problems.push(
        `${LAYOUT_PENDING}: ${entry.id} is also in PENDING_FRAMES. Keep it in one list.`
      )
    if (checked.has(entry.id))
      problems.push(
        `${LAYOUT_PENDING}: ${entry.id} is checked now (${checked.get(entry.id)}). Delete the entry and lower "layoutPending" in ${COUNT_FILE}.`
      )
    waiting.add(entry.id)
  }
  for (const frame of frames) {
    if (!SIGNED_IN_FRAME.test(frame.name)) continue
    if (checked.has(frame.id) || waiting.has(frame.id)) continue
    problems.push(
      `${frame.name} (${frame.id}) counts as covered with no layout check. A snapshot alone covers only marketing frames. Record its layout json with scripts/pen-layout.mjs and import it from a test, or measure it in a screen check that ${RUNS_FILE} lists and scripts/ci-screens.skips.json does not skip.`
    )
  }
  return problems
}

export function ledgerProblems(tree, today) {
  const frameIds = new Set(tree.frames.map((frame) => frame.id))
  const problems = [
    ...entryProblems({
      list: "pendingFrames",
      entries: tree.pending,
      frameIds,
      today,
    }),
    ...entryProblems({
      list: "layoutPending",
      entries: tree.layoutPending,
      frameIds,
      today,
    }),
    ...frameProblems(tree),
  ]
  if (tree.pinned)
    problems.push(
      ...countProblems(
        {
          pendingFrames: tree.pending.length,
          layoutPending: tree.layoutPending.length,
        },
        tree.pinned
      )
    )
  return problems
}

function readRepoFile(file, rev = null) {
  if (rev === null) {
    const full = path.join(root, file)
    return existsSync(full) ? readFileSync(full, "utf8") : null
  }
  try {
    return execFileSync("git", ["show", `${rev}:${file}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    return null
  }
}

const gitLines = (args) => {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean)
  } catch {
    return []
  }
}

export function layoutImports(testFile, text) {
  return [
    ...text.matchAll(
      /(?:from\s+|import\s*\(\s*)["']([^"']+\.layout\.json)["']/g
    ),
  ].flatMap(([, specifier]) => {
    if (specifier.startsWith("@/"))
      return [path.posix.join(WEB_SRC, specifier.slice(2))]
    if (specifier.startsWith("."))
      return [path.posix.join(path.posix.dirname(testFile), specifier)]
    return []
  })
}

export function readTree(rev = null) {
  const read = (file) => readRepoFile(file, rev)
  const files =
    rev === null
      ? gitLines([
          "ls-files",
          "--cached",
          "--others",
          "--exclude-standard",
          WEB_SRC,
        ])
      : gitLines(["ls-tree", "-r", "--name-only", rev, WEB_SRC])
  const layouts = files
    .filter((file) => file.endsWith(".layout.json"))
    .flatMap((file) => {
      const text = read(file)
      if (text === null) return []
      const layout = JSON.parse(text)
      return [{ file, frameId: layout.frameId, driver: layout.driver ?? null }]
    })
  const grepped = gitLines([
    "grep",
    "-l",
    "-F",
    ...(rev === null ? ["--untracked"] : []),
    ".layout.json",
    ...(rev === null ? [] : [rev]),
    "--",
    WEB_SRC,
  ]).map((line) => (rev === null ? line : line.slice(rev.length + 1)))
  const imported = new Set(
    grepped
      .filter((file) => TEST_FILE.test(file))
      .flatMap((file) => layoutImports(file, read(file) ?? ""))
  )
  const manifest = read(MANIFEST)
  if (manifest === null)
    throw new Error(
      `no frame ledger at ${rev ?? "the working tree"}: ${MANIFEST} is missing, so there is nothing to check.`
    )
  const layoutPendingText = read(LAYOUT_PENDING)
  const pinnedText = read(COUNT_FILE)
  return {
    frames: JSON.parse(manifest).frames,
    pending: pendingFramesIn(read(COVERAGE_TEST) ?? ""),
    layoutPending: layoutPendingText ? JSON.parse(layoutPendingText) : [],
    layouts,
    checks: {
      imported,
      runs: screenRuns(read(RUNS_FILE)),
      skipped: new Set(JSON.parse(read(SKIPS) ?? "[]").map((skip) => skip.id)),
    },
    pinned: pinnedText ? JSON.parse(pinnedText) : null,
  }
}

export function main(argv) {
  const at = argv[0] === "--at" ? argv[1] : null
  let tree
  try {
    tree = readTree(at)
  } catch (error) {
    console.log(error.message)
    return 2
  }
  const problems = ledgerProblems(tree, new Date().toISOString().slice(0, 10))
  console.log(`frame ledger at ${at ?? "the working tree"}`)
  for (const problem of problems) console.log(`  ${problem}`)
  console.log(problems.length ? `FIRES (${problems.length})` : "QUIET")
  return problems.length ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv.slice(2))
