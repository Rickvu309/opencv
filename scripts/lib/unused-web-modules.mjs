import path from "node:path"

import ts from "typescript"

export const WEB_SRC = "apps/web/src"
const CHECKED_FOLDERS = ["components", "features", "lib"].map(
  (folder) => `${WEB_SRC}/${folder}/`
)
const TEST_ONLY =
  /\.(?:test|type-test|fixtures)\.[cm]?[jt]sx?$|^apps\/web\/src\/test\//
const MODULE = /\.[cm]?[jt]sx?$/
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]

function isProductModule(file) {
  return MODULE.test(file) && !file.endsWith(".d.ts") && !TEST_ONLY.test(file)
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
  return null
}

export function importedModules(fromFile, text, known) {
  return ts
    .preProcessFile(text, true, true)
    .importedFiles.map((ref) => resolveSpecifier(fromFile, ref.fileName, known))
    .filter((target) => target !== null)
}

export function unusedWebModules(files) {
  const known = new Set(files.map((file) => file.path))
  const imported = new Set()
  for (const file of files) {
    if (!isProductModule(file.path)) continue
    for (const target of importedModules(file.path, file.text, known)) {
      if (target !== file.path) imported.add(target)
    }
  }
  return files
    .map((file) => file.path)
    .filter(
      (file) =>
        isProductModule(file) &&
        CHECKED_FOLDERS.some((folder) => file.startsWith(folder)) &&
        !imported.has(file)
    )
    .sort()
}
