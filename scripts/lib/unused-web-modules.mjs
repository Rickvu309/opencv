import path from "node:path"

import ts from "typescript"

export const WEB_SRC = "apps/web/src"
const TEST_ONLY =
  /\.(?:test|type-test|fixtures)\.[cm]?[jt]sx?$|^apps\/web\/src\/test\//
const MODULE = /\.[cm]?[jt]sx?$/
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
const SOURCES_FOR_JS_SPECIFIER = new Map([
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
])

function isProductModule(file) {
  return (
    file.startsWith(`${WEB_SRC}/`) &&
    MODULE.test(file) &&
    !file.endsWith(".d.ts") &&
    !TEST_ONLY.test(file)
  )
}

function resolveSpecifier(fromFile, specifier, known) {
  let base
  if (specifier.startsWith("@/")) {
    base = `${WEB_SRC}/${specifier.slice(2)}`
  } else if (specifier.startsWith(".")) {
    base = path.posix.normalize(
      path.posix.join(path.posix.dirname(fromFile), specifier)
    )
  } else {
    return null
  }
  for (const suffix of RESOLVE_SUFFIXES) {
    if (known.has(base + suffix)) return base + suffix
  }
  const extension = path.posix.extname(base)
  const stem = base.slice(0, base.length - extension.length)
  for (const source of SOURCES_FOR_JS_SPECIFIER.get(extension) ?? []) {
    if (known.has(stem + source)) return stem + source
  }
  return null
}

export function importedModules(fromFile, text, known) {
  return ts
    .preProcessFile(text, true, true)
    .importedFiles.map((ref) => resolveSpecifier(fromFile, ref.fileName, known))
    .filter((target) => target !== null)
}

export function unusedWebModules(files) {
  const modules = files.filter((file) => isProductModule(file.path))
  const known = new Set(modules.map((file) => file.path))
  const imports = new Map(
    modules.map((file) => [
      file.path,
      importedModules(file.path, file.text, known),
    ])
  )
  const reached = new Set()
  const pending = [`${WEB_SRC}/main.tsx`]
  while (pending.length > 0) {
    const file = pending.pop()
    if (reached.has(file)) continue
    reached.add(file)
    pending.push(...(imports.get(file) ?? []))
  }
  return modules
    .map((file) => file.path)
    .filter((file) => !reached.has(file))
    .sort()
}
