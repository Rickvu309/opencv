import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { PALETTE_DIR, ROUTES_DIR, featureFolders } from "./assumes.mjs"
import { checkLine, summaryLine } from "./tier.mjs"

export const repo = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../.."
)
export const SURFACES = ["coach", "paper", "cv", "apply", "pitch"]

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
export const featureDirs = featureFolders
export const appSourceDirs = () => [...featureDirs(), ROUTES_DIR]
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
export const stale = (id, name, why, rule) => ({
  id,
  name,
  status: "STALE",
  measured: String(why),
  rule,
})
export const judged = (id, name, rule, pass, measured, unjudged = []) => {
  const missing = unjudged.filter(Boolean)
  if (!pass)
    return result(
      id,
      name,
      false,
      missing.length
        ? `${measured}; not judged: ${missing.join("; ")}`
        : measured,
      rule
    )
  if (missing.length)
    return stale(
      id,
      name,
      `not judged: ${missing.join("; ")}; ${measured}`,
      rule
    )
  return result(id, name, true, measured, rule)
}
export const stubSilent = (...snaps) => {
  const quiet = snaps.filter((snap) => !(snap?.stubHits > 0))
  return quiet.length ? "the scenario stub never fired" : null
}

export const EXIT_CODE = Object.freeze({
  allPass: 0,
  anyFailNoStale: 1,
  stackBrowserOrScreenBroken: 2,
  anyStale: 3,
})

export function summarize(results, tier) {
  const lines = results.map(checkLine)
  lines.push(summaryLine(results, tier))
  const by = (status) => results.some((r) => r.status === status)
  return {
    lines,
    exit: by("STALE")
      ? EXIT_CODE.anyStale
      : by("FAIL")
        ? EXIT_CODE.anyFailNoStale
        : EXIT_CODE.allPass,
  }
}

export function context(d) {
  const screens = {
    coach: d.coach,
    paper: d.paper,
    cv: d.cv,
    apply: d.apply,
    pitch: d.pitch,
  }
  const allSnaps = [
    d.coach,
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

export function paletteScan(dir = PALETTE_DIR) {
  const scan = sourceFiles([dir])
  const uses = scan.files.some((file) =>
    /duration-\(--duration-panel\)/.test(read(file))
  )
  return { scan, uses }
}

const aCheck = ["99", "name", "rule"]
export const badFixture = [
  {
    name: "a judged part that breaks the rule while another part is missing",
    fails: () =>
      judged(...aCheck, false, "measured", ["part"]).status === "FAIL",
  },
  {
    name: "a passing check with a part it could not locate",
    fails: () =>
      judged(...aCheck, true, "measured", ["part"]).status !== "PASS",
  },
  {
    name: "a scenario stub that never fired",
    fails: () => stubSilent({ stubHits: 0 }) !== null,
  },
  {
    name: "a run with one failing check",
    fails: () =>
      summarize([result(...aCheck.slice(0, 2), false, "m", "r")], "all")
        .exit === 1,
  },
]
