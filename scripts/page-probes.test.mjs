import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { detect, pageProbes } from "./lib/page-probes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const SCANNED = /^(?:scripts|packages\/guards)\/.+\.[cm]?js$/

const MISTAKE = `export const PROBE_TOLERANCE = { oklchChroma: 0.02 }
function selfContainedProbe(selector) {
  const node = document.querySelector(selector)
  return node ? PROBE_TOLERANCE.oklchChroma : null
}
export const probeSource = (selector) =>
  \`(\${selfContainedProbe.toString()})(\${JSON.stringify(selector)})\`
`

const CLEAN = `export const PROBE_TOLERANCE = { oklchChroma: 0.02 }
function selfContainedProbe(selector, tolerance) {
  const node = document.querySelector(selector)
  return node ? tolerance.oklchChroma : innerWidth
}
export const probeSource = (selector) =>
  \`(\${selfContainedProbe.toString()})(\${JSON.stringify(selector)}, \${JSON.stringify(PROBE_TOLERANCE)})\`
`

test("MISTAKE: a serialized probe that reads a module constant fires", () => {
  const hits = detect(MISTAKE, "mistake.mjs")
  assert.equal(hits.length, 1)
  assert.match(
    hits[0],
    /^mistake\.mjs:4 selfContainedProbe \(sent to the page by toString\): 'PROBE_TOLERANCE' is not defined/
  )
})

test("the same probe taking the value as a parameter stays quiet", () => {
  assert.deepEqual(detect(CLEAN, "clean.mjs"), [])
})

test("every way of turning a function into page code is found", () => {
  const source = `const LIMIT = 3
const measure = () => LIMIT
function viaString() { return LIMIT }
function viaConcat() { return LIMIT }
async function run(page) {
  await page.evaluate(() => LIMIT)
  await page.addInitScript(measure)
  await page.waitForFunction(\`\${String(viaString)}\`)
  await page.evaluate("(" + viaConcat + ")()")
}
export { run }
`
  assert.deepEqual(
    pageProbes(source)
      .map((probe) => probe.via)
      .sort(),
    ["String", "addInitScript", "concatenation", "evaluate"]
  )
  assert.equal(detect(source).length, 4)
})

test("a string with the same name as a function elsewhere is not a probe", () => {
  const source = `const paint = (fill) => {
  const color = (value) => fill[value]
  return color("a")
}
const border = (stroke) => {
  const color = stroke.trim()
  return \`border-color:\${color};\`
}
export { paint, border }
`
  assert.deepEqual(pageProbes(source), [])
})

const trackedScripts = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
    .split("\n")
    .filter((file) => SCANNED.test(file))
    .filter((file) => existsSync(path.join(root, file)))

test("every probe the verify scripts send to the page uses only browser globals and its parameters", () => {
  const hits = []
  for (const file of trackedScripts()) {
    const source = readFileSync(path.join(root, file), "utf8")
    hits.push(...detect(source, file))
  }
  assert.deepEqual(hits, [])
})
