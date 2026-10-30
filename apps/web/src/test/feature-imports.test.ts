// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcDir = fileURLToPath(new URL("..", import.meta.url))
const featuresDir = path.join(srcDir, "features")

const FEATURE_IMPORTS: Record<string, string[]> = {
  apply: [],
  "app-shell": [
    "apply",
    "auth",
    "coach",
    "command-palette",
    "inbox",
    "paper",
    "seed",
  ],
  auth: [],
  coach: [],
  "coming-soon": [],
  "command-palette": [],
  commands: [],
  inbox: ["apply"],
  landing: [],
  paper: ["apply", "coach", "seed"],
  seed: [],
  settings: ["auth"],
}

const SPECIFIER = /["'`]((?:@\/features\/|\.{1,2}\/)[^"'`\s]*)["'`]/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

function featureOf(target: string): string | null {
  const relative = path.relative(featuresDir, target)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  return relative.split(path.sep)[0] ?? null
}

function importedFeature(file: string, specifier: string): string | null {
  if (specifier.startsWith("@/features/")) {
    return specifier.slice("@/features/".length).split("/")[0] ?? null
  }
  return featureOf(path.resolve(path.dirname(file), specifier))
}

function findCycle(graph: Record<string, string[]>): string[] | null {
  const done = new Set<string>()
  const walk = (name: string, trail: string[]): string[] | null => {
    const at = trail.indexOf(name)
    if (at >= 0) return [...trail.slice(at), name]
    if (done.has(name)) return null
    for (const next of graph[name] ?? []) {
      const cycle = walk(next, [...trail, name])
      if (cycle) return cycle
    }
    done.add(name)
    return null
  }
  for (const name of Object.keys(graph)) {
    const cycle = walk(name, [])
    if (cycle) return cycle
  }
  return null
}

describe("feature imports", () => {
  it("lists exactly the folders in features/", () => {
    const folders = readdirSync(featuresDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    const stale = Object.keys(FEATURE_IMPORTS).filter(
      (name) => !folders.includes(name)
    )
    const missing = folders.filter((name) => !(name in FEATURE_IMPORTS))
    const unknownTargets = Object.entries(FEATURE_IMPORTS).flatMap(
      ([name, allowed]) =>
        allowed
          .filter((target) => !existsSync(path.join(featuresDir, target)))
          .map((target) => `${name} -> ${target}`)
    )
    expect(
      { stale, missing, unknownTargets },
      "FEATURE_IMPORTS in apps/web/src/test/feature-imports.test.ts must match the folders in apps/web/src/features. Delete the entries for a removed feature, and add a row for a new one."
    ).toEqual({ stale: [], missing: [], unknownTargets: [] })
  })

  it("imports another feature only along an edge in FEATURE_IMPORTS, and uses every edge", () => {
    const violations: string[] = []
    const used = new Set<string>()
    for (const file of sourceFiles(featuresDir)) {
      const owner = featureOf(file)
      if (!owner) continue
      const allowed = FEATURE_IMPORTS[owner] ?? []
      const text = readFileSync(file, "utf8")
      for (const [, specifier] of text.matchAll(SPECIFIER)) {
        const target = importedFeature(file, specifier!)
        if (!target || target === owner) continue
        if (allowed.includes(target)) {
          used.add(`${owner} -> ${target}`)
          continue
        }
        violations.push(
          `${path.relative(srcDir, file)} imports "${specifier}", so ${owner} depends on ${target}, which FEATURE_IMPORTS in apps/web/src/test/feature-imports.test.ts does not list. Either add "${target}" to ${owner} on purpose, or move the shared code into ${owner}, apps/web/src/lib or packages/*.`
        )
      }
    }
    expect(violations, violations.join("\n")).toEqual([])
    const unused = Object.entries(FEATURE_IMPORTS).flatMap(([owner, allowed]) =>
      allowed
        .map((target) => `${owner} -> ${target}`)
        .filter((edge) => !used.has(edge))
    )
    expect(
      unused,
      "These FEATURE_IMPORTS edges in apps/web/src/test/feature-imports.test.ts have no import left. Delete them."
    ).toEqual([])
  })

  it("has no import cycle between features", () => {
    const cycle = findCycle(FEATURE_IMPORTS)
    expect(
      cycle,
      cycle
        ? `FEATURE_IMPORTS has an import cycle: ${cycle.join(" -> ")}. Move the code both sides need into apps/web/src/lib or apps/web/src/components.`
        : ""
    ).toBeNull()
  })

  it("names the path of a cycle", () => {
    expect(findCycle({ a: ["b"], b: ["c"], c: ["a"], d: [] })).toEqual([
      "a",
      "b",
      "c",
      "a",
    ])
    expect(findCycle({ a: ["b"], b: [], c: ["b"] })).toBeNull()
  })
})
