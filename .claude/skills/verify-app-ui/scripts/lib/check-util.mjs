// Shared by the check files: the repo root, the source scan helpers and the result shape.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const repo = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../.."
)
export const SURFACES = ["home", "paper", "cv", "apply", "pitch"]
export const FEATURE_DIRS = [
  "coach",
  "home",
  "paper",
  "apply",
  "pitch",
  "app-shell",
]

export function sourceFiles(dirs) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(p)
    }
  }
  for (const d of dirs) {
    const abs = join(repo, d)
    if (!existsSync(abs)) continue
    walk(abs)
  }
  return out
}
export const featureFiles = () =>
  sourceFiles(FEATURE_DIRS.map((d) => `apps/web/src/features/${d}`))
export const read = (f) => readFileSync(f, "utf8")
export const rel = (f) => f.replace(`${repo}/`, "")
export const list = (xs, n = 4) =>
  xs.slice(0, n).join("; ") + (xs.length > n ? `; +${xs.length - n} more` : "")
export const result = (id, name, pass, measured, rule) => ({
  id,
  name,
  pass,
  measured: String(measured),
  rule,
})

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
  ]
  const files = featureFiles()
  const has = (re) => files.filter((f) => re.test(read(f))).map(rel)
  return {
    screens,
    allSnaps,
    labels: [...new Set(allSnaps.flatMap((s) => s.chrome))],
    files,
    has,
  }
}

// Every timer-driven motion under features/pitch and the use-* hooks it imports. A setTimeout that only
// resets a flag (setCopied(false)) is feedback, not motion, and is skipped.
export function pitchTimers() {
  const files = sourceFiles(["apps/web/src/features/pitch"])
  const hooks = []
  for (const f of files) {
    for (const m of read(f).matchAll(
      /from\s+["']((?:@\/|\.\/|\.\.\/)[^"']+)["']/g
    )) {
      const spec = m[1]
      const p = spec.startsWith("@/")
        ? join(repo, "apps/web/src", spec.slice(2))
        : resolve(dirname(f), spec)
      if (/\/use-[^/]+\.tsx?$/.test(p) && existsSync(p)) hooks.push(p)
    }
  }
  const out = []
  for (const f of new Set([...files, ...hooks])) {
    const src = read(f)
    const apis = []
    if (/requestAnimationFrame/.test(src)) apis.push("requestAnimationFrame")
    if (/setInterval/.test(src)) apis.push("setInterval")
    for (const m of src.matchAll(
      /setTimeout\(\s*(?:\(\)\s*=>\s*)?([^,]*?),\s*(\d+)/g
    )) {
      if (!/^set\w+\(\s*(false|null)\s*\)$/.test(m[1].trim()))
        apis.push(`setTimeout ${m[2]}ms`)
    }
    if (apis.length)
      out.push({
        file: rel(f),
        apis,
        guarded: /prefers-reduced-motion|useReducedMotion/.test(src),
      })
  }
  return out
}
