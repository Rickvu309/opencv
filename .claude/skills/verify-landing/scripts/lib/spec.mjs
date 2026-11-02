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

const FIELDS = {
  27: { viewBox: "string", cards: "number", shapes: "number" },
  28: {
    gapMin: "number",
    gapMax: "number",
    fontSize: "number",
    fontWeight: "number",
    markInset: "number",
  },
  29: { tolerance: "number", fontWeight: "number" },
  30: {
    reference: "string",
    title: "string",
    raster: "number",
    channelDelta: "number",
    maxRatio: "number",
  },
}
const BUTTON = {
  scope: "string",
  label: "string",
  height: "number",
  fontSize: "number",
  padInline: "number",
  inset: "boolean",
  outer: "boolean",
  borderVisible: "boolean",
  pill: "boolean",
}
const lacking = (where, shape) =>
  Object.entries(shape)
    .filter(([key, type]) => typeof where?.[key] !== type)
    .map(([key]) => key)

export const specProblem = (spec) => {
  for (const [id, shape] of Object.entries(FIELDS)) {
    if (typeof spec?.[id] !== "object" || !spec[id]) return `no section ${id}`
    const bad = lacking(spec[id], shape)
    if (bad.length) return `section ${id} lacks ${bad.join(", ")}`
  }
  const buttons = Object.entries(spec["29"].buttons ?? {})
  if (buttons.length === 0) return "section 29 has no buttons"
  for (const [key, button] of buttons) {
    const bad = lacking(button, BUTTON)
    if (bad.length) return `29 button ${key} lacks ${bad.join(", ")}`
  }
  return null
}

export function loadSpecOrError() {
  try {
    const spec = loadSpec()
    const problem = specProblem(spec)
    return problem ? { error: `${FILES.spec}: ${problem}` } : spec
  } catch (error) {
    return { error: `cannot read ${FILES.spec}: ${error.message}` }
  }
}
