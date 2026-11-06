import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))
const imports = (source) =>
  [...source.matchAll(/import\(["'](@\/[^"']+)["']\)/g)].map(
    (match) => match[1]
  )
const localPath = (specifier) => `apps/web/src/${specifier.slice(2)}`

export function detect(source, file, io) {
  const warmed = new Set(imports(source))
  const visited = new Set()
  const pending = [...warmed]
  const missing = new Set()
  while (pending.length) {
    const specifier = pending.pop()
    if (visited.has(specifier)) continue
    visited.add(specifier)
    const nested = io.read(localPath(specifier))
    if (nested === null) continue
    for (const dependency of imports(nested)) {
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
