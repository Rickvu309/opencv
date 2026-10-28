// Shared by the check files: the repo root, the source scan helpers and the result shape.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const repo = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../.."
)
export const SURFACES = ["home", "paper", "cv", "apply", "pitch"]
// Signed-in app source. Pitch and Proof live in coming-soon (features/pitch went in #389).
export const FEATURE_DIRS = [
  "coach",
  "home",
  "paper",
  "apply",
  "coming-soon",
  "inbox",
  "settings",
  "command-palette",
  "commands",
  "app-shell",
]

// Returns the files and the folders that do not exist, so a check can go STALE instead of passing on nothing.
export function sourceFiles(dirs) {
  const files = []
  const missing = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) files.push(p)
    }
  }
  for (const d of dirs) {
    const abs = join(repo, d)
    if (existsSync(abs)) walk(abs)
    else missing.push(d)
  }
  return { files, missing }
}
export const featureDirs = () =>
  FEATURE_DIRS.map((d) => `apps/web/src/features/${d}`)
export const appSourceDirs = () => [...featureDirs(), "apps/web/src/routes"]
export const scanProblem = (...scans) => {
  const missing = scans.flatMap((scan) => scan.missing)
  if (missing.length) return `source folder missing: ${missing.join(", ")}`
  if (scans.some((scan) => scan.files.length === 0))
    return "the source scan read zero files"
  return null
}
export const read = (f) => readFileSync(f, "utf8")
export const rel = (f) => f.replace(`${repo}/`, "")
export const list = (xs, n = 4) =>
  xs.slice(0, n).join("; ") + (xs.length > n ? `; +${xs.length - n} more` : "")
export const result = (id, name, pass, measured, rule) => ({
  id,
  name,
  status: pass ? "PASS" : "FAIL",
  measured: String(measured),
  rule,
})
// The check's own precondition did not hold, so it says nothing about the app.
export const stale = (id, name, why, rule) => ({
  id,
  name,
  status: "STALE",
  measured: String(why),
  rule,
})
// A scenario stub that answered nothing means the app made a call the tour no longer expects.
export const stubSilent = (...snaps) => {
  const quiet = snaps.filter((snap) => !(snap?.stubHits > 0))
  return quiet.length ? "the scenario stub never fired" : null
}

export function summarize(results) {
  const lines = results.map(
    (r) =>
      `${r.status} ${r.id} ${r.name}: ${r.measured.slice(0, 230)} | rule: ${r.rule}`
  )
  const by = (status) => results.filter((r) => r.status === status)
  const [failed, staled] = [by("FAIL"), by("STALE")]
  const ids = [...failed, ...staled].map((r) => r.id)
  lines.push(
    `${by("PASS").length} PASS, ${failed.length} FAIL, ${staled.length} STALE${ids.length ? `: ${ids.join(" ")}` : ""}`
  )
  return { lines, exit: staled.length ? 3 : failed.length ? 1 : 0 }
}

export function context(d) {
  const screens = {
    home: d.home,
    paper: d.paper,
    cv: d.cv,
    apply: d.apply,
    pitch: d.pitch,
  }
  const allSnaps = [
    d.home,
    d.palette,
    d.thread,
    d.paper,
    d.cv,
    d.cvCoach,
    d.apply,
    d.pitch,
    d.pitchStory,
    d.pitchEdit,
    d.coachError,
    d.coachNet,
    d.paperLoading,
    d.applyEmpty,
    ...(d.inbox ? [d.inbox] : []),
  ]
  const scan = sourceFiles(featureDirs())
  const has = (re) => scan.files.filter((f) => re.test(read(f))).map(rel)
  return {
    scan,
    screens,
    allSnaps,
    labels: [...new Set(allSnaps.flatMap((s) => s.chrome))],
    has,
  }
}

export function paletteScan() {
  const scan = sourceFiles(["apps/web/src/features/command-palette"])
  const uses = scan.files.some((file) =>
    /duration-\(--duration-panel\)/.test(read(file))
  )
  return { scan, uses }
}
