import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { runtimeDynamicImports } from "./source-imports.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url))

export const runtimeImports = runtimeDynamicImports

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
