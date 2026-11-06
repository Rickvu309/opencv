import { readFileSync } from "node:fs"
import { dirname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))
const webSource = "apps/web/src"
const dynamicImport =
  /(?<![\w.$])import\(\s*["']([^"']+)["']\s*\)(?!\s*\.\s*(?!then\b|catch\b|finally\b)[A-Za-z_$])/g

function toRepoPath(specifier, importer) {
  if (specifier.startsWith("@/"))
    return normalize(join(webSource, specifier.slice(2)))
  if (specifier.startsWith("."))
    return normalize(join(dirname(importer), specifier))
  return null
}

export function runtimeImports(source, importer) {
  return [...source.matchAll(dynamicImport)]
    .map((match) => toRepoPath(match[1], importer))
    .filter((path) => path !== null)
}

export function detect(source, file, io) {
  const warmed = new Set(runtimeImports(source, file))
  const visited = new Set()
  const pending = [...warmed]
  const missing = new Set()
  while (pending.length) {
    const path = pending.pop()
    if (visited.has(path)) continue
    visited.add(path)
    const nested = io.read(path)
    if (nested === null) continue
    for (const dependency of runtimeImports(nested, path)) {
      if (!warmed.has(dependency)) missing.add(dependency)
      pending.push(dependency)
    }
  }
  return [...missing].sort()
}

export function inspect(
  source,
  file,
  io = {
    read: (name) => {
      try {
        return readFileSync(resolve(root, name), "utf8")
      } catch {
        return null
      }
    },
  }
) {
  return detect(source, file, io)
}
