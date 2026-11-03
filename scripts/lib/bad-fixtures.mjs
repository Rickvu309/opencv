import { readdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export const LIB_DIRS = Object.freeze([
  ".claude/skills/verify-app-ui/scripts/lib",
  ".claude/skills/verify-landing/scripts/lib",
])
export const SIDECAR = ".bad-fixture.mjs"
export const PENDING_CEILING = 18
export const NOT_CHECKS_CEILING = 13
export const PENDING_LATEST_EXPIRY = "2026-12-15"
export const PENDING_FROZEN = Object.freeze([
  ".claude/skills/verify-app-ui/scripts/lib/apply-pen-gaps.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/checks-source.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/pen-layout-probe.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/probe-colors.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/probe.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/sidebar-account-checks.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/sidebar-collapsed-checks.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/sidebar-drag-checks.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/sidebar-geometry.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/sidebar-interactions.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/sidebar-resize-checks.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/sidebar-resize-shared.mjs",
  ".claude/skills/verify-app-ui/scripts/lib/sidebar-round3-checks.mjs",
  ".claude/skills/verify-landing/scripts/lib/design-checks.mjs",
  ".claude/skills/verify-landing/scripts/lib/design-probe.mjs",
  ".claude/skills/verify-landing/scripts/lib/page-checks.mjs",
  ".claude/skills/verify-landing/scripts/lib/pen-probe.mjs",
  ".claude/skills/verify-landing/scripts/lib/probe.mjs",
])

const isCheckModule = (name) =>
  name.endsWith(".mjs") &&
  !name.endsWith(".test.mjs") &&
  !name.endsWith(SIDECAR)

export function libModules(root, dirs = LIB_DIRS) {
  return dirs.flatMap((dir) =>
    readdirSync(path.join(root, dir))
      .filter(isCheckModule)
      .sort()
      .map((name) => `${dir}/${name}`)
  )
}

export async function loadFixtures(root, file) {
  const own = await import(pathToFileURL(path.join(root, file)))
  const sidecar = file.replace(/\.mjs$/, SIDECAR)
  let beside
  try {
    beside = (await import(pathToFileURL(path.join(root, sidecar)))).badFixture
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error
  }
  if (own.badFixture && beside)
    throw new Error(`${file} and ${sidecar} both export a badFixture. Keep one`)
  return own.badFixture ?? beside
}

export function coverageProblems({
  files,
  fixtures,
  notChecks: notCheckEntries,
  pending,
  today,
}) {
  const problems = []
  const notChecks = notCheckEntries.map((entry) => entry.file)
  const pendingFiles = pending.map((entry) => entry.file)
  for (const entry of notCheckEntries)
    if (!entry.why?.trim())
      problems.push(`${entry.file}: a notChecks entry needs a why`)
  for (const file of files) {
    const has = Array.isArray(fixtures[file]) && fixtures[file].length > 0
    const listed = [
      notChecks.includes(file) && "notChecks",
      pendingFiles.includes(file) && "pending",
    ].filter(Boolean)
    if (has && listed.length)
      problems.push(`${file} has a bad fixture and is also on ${listed[0]}`)
    else if (!has && listed.length === 0)
      problems.push(
        `${file} exports no badFixture and is on no list. Export a badFixture the check fails on, or list it as pending with an issue and an expiry`
      )
    else if (listed.length > 1)
      problems.push(`${file} is on both notChecks and pending`)
  }
  for (const file of [...notChecks, ...pendingFiles])
    if (!files.includes(file))
      problems.push(`${file} is listed but is not a check module. Remove it`)
  for (const entry of pending) {
    if (!/^#\d+$/.test(entry.issue ?? ""))
      problems.push(`${entry.file}: pending entry needs an issue like #963`)
    if (!entry.reason?.trim())
      problems.push(`${entry.file}: pending entry needs a reason`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? ""))
      problems.push(`${entry.file}: pending entry needs an expiry date`)
    else if (entry.expires < today)
      problems.push(
        `${entry.file}: pending for ${entry.issue} expired on ${entry.expires}. Add its bad fixture and delete the entry`
      )
  }
  return problems
}

export function fixtureProblems(file, fixtures) {
  const problems = []
  const names = new Set()
  for (const fixture of fixtures ?? []) {
    if (!fixture.name?.trim() || typeof fixture.fails !== "function") {
      problems.push(`${file}: a fixture needs a name and a fails function`)
      continue
    }
    if (names.has(fixture.name))
      problems.push(`${file}: two fixtures are named "${fixture.name}"`)
    names.add(fixture.name)
    if (fixture.fails() !== true)
      problems.push(
        `${file}: the check did not fail on its bad fixture "${fixture.name}"`
      )
  }
  return problems
}

export function shrinkProblems({
  pending,
  notChecks,
  pendingCeiling = PENDING_CEILING,
  notChecksCeiling = NOT_CHECKS_CEILING,
  latestExpiry = PENDING_LATEST_EXPIRY,
  frozen = PENDING_FROZEN,
}) {
  const problems = []
  if (pending.length > pendingCeiling)
    problems.push(
      `pending has ${pending.length} entries but the ceiling is ${pendingCeiling}. The list may only shrink: add the bad fixture instead`
    )
  if (notChecks.length > notChecksCeiling)
    problems.push(
      `notChecks has ${notChecks.length} entries but the ceiling is ${notChecksCeiling}. Give the new module a bad fixture instead`
    )
  for (const entry of pending) {
    if (!frozen.includes(entry.file))
      problems.push(
        `${entry.file} is a new pending entry. The list was frozen with its first set of modules`
      )
    if (entry.expires > latestExpiry)
      problems.push(
        `${entry.file}: expires ${entry.expires}, later than the fixed date ${latestExpiry}. An expiry may not move out`
      )
  }
  return problems
}
