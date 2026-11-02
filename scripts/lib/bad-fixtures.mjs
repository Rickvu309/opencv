import { readdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export const LIB_DIRS = Object.freeze([
  ".claude/skills/verify-app-ui/scripts/lib",
  ".claude/skills/verify-landing/scripts/lib",
])
export const SIDECAR = ".bad-fixture.mjs"

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
  if (own.badFixture) return own.badFixture
  const sidecar = file.replace(/\.mjs$/, SIDECAR)
  try {
    return (await import(pathToFileURL(path.join(root, sidecar)))).badFixture
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND") return undefined
    throw error
  }
}

export function coverageProblems({
  files,
  fixtures,
  notChecks,
  pending,
  today,
}) {
  const problems = []
  const pendingFiles = pending.map((entry) => entry.file)
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
