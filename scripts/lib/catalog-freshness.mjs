import { CatalogError } from "./operation-catalog.mjs"
import { staleFiles } from "./catalog-stale.mjs"

export function staleOutputs(expected, current) {
  return staleFiles(expected, current).map(
    (file) =>
      new CatalogError(
        "stale-output",
        file,
        file in expected
          ? "run node scripts/catalog.mjs generate"
          : "not a generated output; run node scripts/catalog.mjs generate"
      )
  )
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
