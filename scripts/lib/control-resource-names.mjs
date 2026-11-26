import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")

export const CONTROL_DIR = "apps/api/src/registry"
export const RESOURCES_FILE = "packages/domain/src/resources.ts"

export function declaredResourceNames(text) {
  return [...text.matchAll(/name:\s*"([^"]+)",\s*coachFloor:/g)].map(
    (match) => match[1]
  )
}

function readNames() {
  return declaredResourceNames(
    readFileSync(path.join(root, RESOURCES_FILE), "utf8")
  )
}

export function detect(text, file = "source.ts", given) {
  const names = Array.isArray(given) ? given : readNames()
  const problems = []
  text.split("\n").forEach((line, index) => {
    for (const name of names)
      if (
        [`"${name}"`, `'${name}'`, `\`${name}\``].some((q) => line.includes(q))
      )
        problems.push({ kind: "names-resource", name, file, line: index + 1 })
  })
  return problems
}

export function controlSources(dir = path.join(root, CONTROL_DIR)) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return controlSources(full)
    const testOnly = /\.(test|test-support|type-test|support)\.ts$/.test(entry)
    return entry.endsWith(".ts") && !testOnly ? [full] : []
  })
}

export function controlProblems() {
  const names = readNames()
  return controlSources().flatMap((full) =>
    detect(readFileSync(full, "utf8"), path.relative(root, full), names)
  )
}
