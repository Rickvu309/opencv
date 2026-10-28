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

const SECTIONS = ["27", "28", "29", "30"]
export const specProblem = (spec) => {
  const missing = SECTIONS.filter(
    (id) => typeof spec?.[id] !== "object" || !spec[id]
  )
  if (missing.length) return `no section ${missing.join(", ")}`
  return Object.keys(spec["29"].buttons ?? {}).length === 0
    ? "section 29 has no buttons"
    : null
}

// A spec that is missing or malformed gives { error }, so 27 to 30 report STALE instead of the run throwing.
export function loadSpecOrError() {
  try {
    const spec = loadSpec()
    const problem = specProblem(spec)
    return problem ? { error: `${FILES.spec}: ${problem}` } : spec
  } catch (error) {
    return { error: `cannot read ${FILES.spec}: ${error.message}` }
  }
}
