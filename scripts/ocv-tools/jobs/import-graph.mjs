import { posix } from "node:path"
import { configRule } from "./test-accounting.mjs"

export const CODE_EXT = /\.(?:[cm]?[jt]sx?)$/
const FIXTURE_DATA = "scripts/ocv-tools/"
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/

const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bvi\.mock\(\s*)["']([^"']+)["']/g

const PACKAGE_SOURCE = [
  [/^@workspace\/ui\/(components|lib|hooks)\/(.+)$/, "packages/ui/src/$1/$2"],
  [/^@workspace\/([a-z0-9-]+)$/, "packages/$1/src/index"],
  [/^@workspace\/([a-z0-9-]+)\/(.+)$/, "packages/$1/src/$2"],
]

const PATH_LITERAL = /["'`]((?:\.{1,2}\/)*[\w@-][\w@.\-/]*\.[A-Za-z0-9]+)["'`]/g

const packageRootOf = (file) =>
  file.match(/^((?:apps|packages)\/[^/]+)\//)?.[1] ?? "."

export function importedStems(file, text) {
  const stems = new Set()
  for (const match of String(text).matchAll(SPECIFIER)) {
    const spec = match[1]
    let target = null
    if (spec.startsWith(".")) target = posix.join(posix.dirname(file), spec)
    else if (spec.startsWith("@/") && file.startsWith("apps/web/"))
      target = `apps/web/src/${spec.slice(2)}`
    else {
      const row = PACKAGE_SOURCE.find(([pattern]) => pattern.test(spec))
      if (row) target = spec.replace(row[0], row[1])
    }
    if (!target) continue
    const stem = target.replace(CODE_EXT, "")
    stems.add(stem)
    stems.add(`${stem}/index`)
  }
  return stems
}

const RUNNABLE = /\.[cm]?js$/

export function namedPaths(file, text) {
  const runs = new Set()
  const reads = new Set()
  const bases = new Set([posix.dirname(file), packageRootOf(file), "."])
  for (const match of String(text).matchAll(PATH_LITERAL))
    for (const base of bases) {
      const target = posix.join(base, match[1])
      if (target.startsWith("..")) continue
      if (
        RUNNABLE.test(target) ||
        (configRule(file) && !TEST_FILE.test(target))
      )
        runs.add(target.replace(CODE_EXT, ""))
      else reads.add(target)
    }
  return { runs, reads }
}

export function add(map, key, value) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function importGraph(paths, textOf) {
  const known = new Set(paths)
  const byStem = new Map()
  for (const path of paths) add(byStem, path.replace(CODE_EXT, ""), path)
  const importersOf = new Map()
  const readersOf = new Map()
  for (const file of paths) {
    if (!CODE_EXT.test(file)) continue
    const text = textOf(file)
    const { runs, reads } = namedPaths(file, text)
    const imports = new Set()
    for (const stem of [...importedStems(file, text), ...runs])
      for (const target of byStem.get(stem) ?? [])
        if (target !== file) imports.add(target)
    for (const target of imports) add(importersOf, target, file)
    if (!TEST_FILE.test(file) || file.startsWith(FIXTURE_DATA)) continue
    for (const target of reads)
      if (target !== file && known.has(target) && !imports.has(target))
        add(readersOf, target, file)
  }
  return { importersOf, readersOf }
}

export function closureOf({ importersOf, readersOf }, file) {
  const seen = new Set([file, ...(readersOf.get(file) ?? [])])
  const queue = [...seen]
  while (queue.length)
    for (const by of importersOf.get(queue.pop()) ?? [])
      if (!seen.has(by)) {
        seen.add(by)
        queue.push(by)
      }
  seen.delete(file)
  return [...seen].sort()
}
