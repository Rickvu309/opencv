import { CatalogError } from "./operation-catalog.mjs"

const lineEndings = (text) => text?.replace(/\r\n?/g, "\n")

export const generatedDirectories = (expected) => [
  ...new Set(
    Object.keys(expected).map((file) => file.slice(0, file.lastIndexOf("/")))
  ),
]

export function staleOutputs(expected, current) {
  const errors = []
  for (const [file, content] of Object.entries(expected))
    if (lineEndings(current[file]) !== content)
      errors.push(
        new CatalogError(
          "stale-output",
          file,
          "run node scripts/catalog.mjs generate"
        )
      )
  for (const file of Object.keys(current))
    if (!(file in expected))
      errors.push(
        new CatalogError(
          "stale-output",
          file,
          "not a generated output; run node scripts/catalog.mjs generate"
        )
      )
  return errors
}

const digestFile = /(?:^|\/)generated\/catalog\.digest$/

const conflictProneLines = [
  [
    /^export const catalogDigest\b/,
    "a whole-catalog digest rewrites this line on every contract edit",
  ],
  [
    /\b(?:operation|implementation)\d+\b/,
    "index aliases renumber every later line when one operation is added",
  ],
]

export function detectConflictProneLayout(text, file = "catalog.ts") {
  if (digestFile.test(file))
    return [
      {
        file,
        line: 1,
        detail: "a whole-catalog digest file changes on every contract edit",
      },
    ]
  return text
    .split(/\r?\n/)
    .flatMap((line, index) =>
      conflictProneLines
        .filter(([pattern]) => pattern.test(line))
        .map(([, detail]) => ({ file, line: index + 1, detail }))
    )
}
