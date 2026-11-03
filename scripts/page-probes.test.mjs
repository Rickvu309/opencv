import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { detect, pageProbes } from "./lib/page-probes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const SCANNED = /^(?:\.claude\/skills|scripts|packages\/guards)\/.+\.[cm]?js$/

const MISTAKE = `export const PEN_TOLERANCE = { oklchChroma: 0.02 }
function selfContainedPenProbe(selector) {
  const node = document.querySelector(selector)
  return node ? PEN_TOLERANCE.oklchChroma : null
}
export const penProbeSource = (selector) =>
  \`(\${selfContainedPenProbe.toString()})(\${JSON.stringify(selector)})\`
`

const CLEAN = `export const PEN_TOLERANCE = { oklchChroma: 0.02 }
function selfContainedPenProbe(selector, tolerance) {
  const node = document.querySelector(selector)
  return node ? tolerance.oklchChroma : innerWidth
}
export const penProbeSource = (selector) =>
  \`(\${selfContainedPenProbe.toString()})(\${JSON.stringify(selector)}, \${JSON.stringify(PEN_TOLERANCE)})\`
`

test("MISTAKE: a serialized probe that reads a module constant fires", () => {
  const hits = detect(MISTAKE, "mistake.mjs")
  assert.equal(hits.length, 1)
  assert.match(
    hits[0],
    /^mistake\.mjs:4 selfContainedPenProbe \(sent to the page by toString\): 'PEN_TOLERANCE' is not defined/
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

const KNOWN_PROBES = [
  ".claude/skills/verify-app-ui/scripts/lib/probe.mjs selfContainedProbeThatOnlyMeasures",
  ".claude/skills/verify-app-ui/scripts/lib/probe-colors.mjs selfContainedProbeColors",
  ".claude/skills/verify-app-ui/scripts/lib/pen-parity.mjs selfContainedPenProbe",
  ".claude/skills/verify-app-ui/scripts/lib/pen-layout-probe.mjs selfContainedProbeSharedByPenAndApp",
  ".claude/skills/verify-landing/scripts/lib/probe.mjs probe",
  ".claude/skills/verify-landing/scripts/lib/design-probe.mjs designProbe",
  ".claude/skills/verify-landing/scripts/lib/pen-probe.mjs penProbe",
]

test("every probe the verify scripts send to the page uses only browser globals and its parameters", () => {
  const found = []
  const hits = []
  for (const file of trackedScripts()) {
    const source = readFileSync(path.join(root, file), "utf8")
    for (const probe of pageProbes(source)) found.push(`${file} ${probe.name}`)
    hits.push(...detect(source, file))
  }
  for (const known of KNOWN_PROBES)
    assert.ok(found.includes(known), `discovery no longer finds ${known}`)
  assert.deepEqual(hits, [])
})
