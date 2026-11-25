const WATCHED = new Set([
  "packages/domain/src/paper-doc/paper-package.ts",
  "packages/domain/src/paper-doc/paper-contract.ts",
  "apps/api/src/paper/package-engine.ts",
])

const OPS = [
  '"split"',
  '"insertAfter"',
  '"mergePrevious"',
  '"deleteParagraph"',
  "'split'",
  "'insertAfter'",
  "'mergePrevious'",
  "'deleteParagraph'",
]

export function detect(source, file) {
  const name = String(file).replaceAll("\\", "/")
  if (!WATCHED.has(name)) return []
  if (!OPS.some((op) => source.includes(op))) return []
  return [{ kind: "paper-canvas", detail: "edit-accepts-enter" }]
}
