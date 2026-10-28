// The only reader of files under a design/ or reference/ folder. The invariant tier never calls it, and
// the unit test reads designReads to prove that.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { FILES } from "./assumes.mjs"

export const repo = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../.."
)
export const designReads = []

export function readDesignFile(path, encoding) {
  designReads.push(path)
  return readFileSync(join(repo, path), encoding)
}

export const loadSpec = () => JSON.parse(readDesignFile(FILES.spec, "utf8"))
