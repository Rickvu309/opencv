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
