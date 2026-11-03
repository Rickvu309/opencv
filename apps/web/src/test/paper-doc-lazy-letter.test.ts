// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ROUTE = join(SRC, "routes/paper-doc.tsx")

const EAGER_IMPORT =
  /^\s*(?:import|export)\s+(type\s+)?(?:[^'";()]*?\sfrom\s+)?["']([^"']+)["']/gm

const FORBIDDEN_PACKAGES = [
  /^@blocknote\//,
  /^yjs$/,
  /^y-prosemirror$/,
  /^@workspace\/paper-crdt(\/|$)/,
]

const FORBIDDEN_FILES = [/^lib\/paper-sync[^/]*$/]

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null
  if (base === null) return null
  for (const extension of EXTENSIONS) {
    const candidate = base + extension
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function eagerSpecifiers(file: string) {
  return [...readFileSync(file, "utf8").matchAll(EAGER_IMPORT)]
    .filter((match) => match[1] === undefined)
    .map((match) => match[2]!)
}

function eagerPathsToEditor(entry: string) {
  const offenders: string[] = []
  const chainOf = new Map<string, string[]>([[entry, [entry]]])
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    const chain = chainOf.get(file)!
    for (const specifier of eagerSpecifiers(file)) {
      const named = (steps: string[]) =>
        steps.map((step) => relative(SRC, step)).join(" > ")
      if (FORBIDDEN_PACKAGES.some((rule) => rule.test(specifier))) {
        offenders.push(`${named(chain)} > ${specifier}`)
        continue
      }
      const target = resolveLocal(file, specifier)
      if (target === null || !target.startsWith(SRC)) continue
      const local = relative(SRC, target).replace(/\.tsx?$/, "")
      if (FORBIDDEN_FILES.some((rule) => rule.test(local))) {
        offenders.push(named([...chain, target]))
        continue
      }
      if (chainOf.has(target)) continue
      chainOf.set(target, [...chain, target])
      queue.push(target)
    }
  }
  return { offenders, walked: chainOf.size }
}

it("reaches the letter editor from the Paper route only through a dynamic import", () => {
  const { offenders, walked } = eagerPathsToEditor(ROUTE)
  expect(offenders).toEqual([])
  expect(walked).toBeGreaterThan(5)
  expect(readFileSync(ROUTE, "utf8")).toMatch(
    /lazy\(\(\) =>\s*import\("@\/features\/paper\/paper-letter\.tsx"\)/
  )
  expect(readFileSync(ROUTE, "utf8")).toMatch(
    /lazy\(\(\) =>\s*import\("@\/features\/paper\/paper-cv-editor\.tsx"\)/
  )
})

it("finds an eager import of the editor however deep it sits", () => {
  const letter = join(SRC, "features/paper/paper-letter.tsx")
  expect(eagerPathsToEditor(letter).offenders.length).toBeGreaterThan(0)
})
