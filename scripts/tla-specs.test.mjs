import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { allRuns, resolveJar, resolveJava, statusOf, tlcArgs } from "./tlc.mjs"
import { tempDir } from "./lib/temp-dir.mjs"
import { exportedNames, specProblems } from "./lib/tla-specs.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const FIXTURE = "scripts/tla/fixtures/Counter"

const tracked = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "*.tla",
      "*.tla.json",
      "*.cfg",
      "*.mjs",
      "*.ts",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)

const TLA = "---- MODULE Spec ----\nStep == x' = x + 1\n====\n"
const MAP = JSON.stringify({ module: "spec.mjs", actions: { Step: "step" } })
const MODULE = "export function step() {}\n"

const complete = () => ({
  "a/Spec.tla": TLA,
  "a/Spec.cfg": "",
  "a/Spec.mutant.cfg": "",
  "a/Spec.tla.json": MAP,
  "a/spec.mjs": MODULE,
})

const problemsOf = (files) =>
  specProblems(Object.keys(files), (path) => files[path])

const without = (files, path) => {
  const { [path]: _gone, ...rest } = files
  return rest
}

test("a complete spec has no problems", () => {
  assert.deepEqual(problemsOf(complete()), [])
})

test("a spec with no cfg is a problem", () => {
  assert.match(
    problemsOf(without(complete(), "a/Spec.cfg"))[0],
    /no a\/Spec\.cfg/
  )
})

test("a spec with no action map is a problem", () => {
  assert.match(
    problemsOf(without(complete(), "a/Spec.tla.json"))[0],
    /no a\/Spec\.tla\.json/
  )
})

test("a cfg with no mutant cfg is a problem", () => {
  assert.match(
    problemsOf(without(complete(), "a/Spec.mutant.cfg"))[0],
    /no a\/Spec\.mutant\.cfg/
  )
})

test("a second cfg of the same spec needs its own mutant", () => {
  const files = { ...complete(), "a/Spec.big.cfg": "" }
  assert.match(
    problemsOf(files)[0],
    /Spec\.big\.cfg: no a\/Spec\.big\.mutant\.cfg/
  )
})

test("a mutant cfg with no real cfg is a problem", () => {
  const files = { ...complete(), "a/Spec.big.mutant.cfg": "" }
  assert.match(
    problemsOf(files)[0],
    /Spec\.big\.mutant\.cfg: no a\/Spec\.big\.cfg/
  )
})

test("a map entry naming a function the module does not export is a problem", () => {
  const files = {
    ...complete(),
    "a/Spec.tla.json": JSON.stringify({
      module: "spec.mjs",
      actions: { Step: "missing" },
    }),
  }
  assert.match(
    problemsOf(files)[0],
    /Step names missing, which a\/spec\.mjs does not export/
  )
})

test("a map entry for an action the spec does not define is a problem", () => {
  const files = {
    ...complete(),
    "a/Spec.tla.json": JSON.stringify({
      module: "spec.mjs",
      actions: { Gone: "step" },
    }),
  }
  assert.match(problemsOf(files)[0], /Gone is not defined in the \.tla/)
})

test("a map whose module is missing or whose shape is wrong is a problem", () => {
  const noModule = without(complete(), "a/spec.mjs")
  assert.match(problemsOf(noModule)[0], /module a\/spec\.mjs not found/)
  const badShape = { ...complete(), "a/Spec.tla.json": "{}" }
  assert.match(problemsOf(badShape)[0], /needs a "module"/)
  const notJson = { ...complete(), "a/Spec.tla.json": "nope" }
  assert.match(problemsOf(notJson)[0], /not valid JSON/)
})

test("exports are read from declarations, lists and typescript", () => {
  const names = exportedNames(
    [
      "export function a() {}",
      "export const b = 1, c = 2",
      "export class D {}",
      "function e() {}",
      "export { e, e as f }",
      "export type G = string",
      "export async function h(): Promise<void> {}",
    ].join("\n"),
    "x.ts"
  )
  assert.deepEqual([...names].sort(), ["D", "a", "b", "c", "e", "f", "h"])
})

test("every spec in the repo is complete", () => {
  const files = tracked()
  assert.ok(files.some((file) => file.endsWith(".tla")))
  assert.deepEqual(
    specProblems(files, (path) => readFileSync(join(root, path), "utf8")),
    []
  )
})

test("every cfg of every spec is run, with its mutant expected to fail", () => {
  const runs = allRuns([
    `${FIXTURE}.tla`,
    `${FIXTURE}.cfg`,
    `${FIXTURE}.mutant.cfg`,
  ])
  assert.deepEqual(
    runs.map(({ cfg, expect }) => [cfg, expect]),
    [
      [`${FIXTURE}.cfg`, 0],
      [`${FIXTURE}.mutant.cfg`, 12],
    ]
  )
})

test("exit codes map to what happened", () => {
  assert.deepEqual([0, 10, 11, 12, 13, 150, 151].map(statusOf), [
    "ok",
    "assumption violated",
    "deadlock",
    "invariant violated",
    "liveness violated",
    "error",
    "error",
  ])
})

test("java and the jar come from the environment, else the home folder", () => {
  const exists = () => true
  assert.equal(
    resolveJava({ env: { JAVA_HOME: "/j" }, home: "/h", exists }),
    "/j/bin/java"
  )
  assert.equal(
    resolveJava({ env: {}, home: "/h", exists }),
    "/h/.local/jdk/bin/java"
  )
  assert.equal(
    resolveJar({ env: { TLA2TOOLS: "/t.jar" }, home: "/h", exists }),
    "/t.jar"
  )
  assert.equal(
    resolveJar({ env: {}, home: "/h", exists }),
    "/h/.local/tla/tla2tools.jar"
  )
  assert.equal(resolveJava({ env: {}, home: "/h", exists: () => false }), null)
})

test("tlc runs one worker on the parallel collector", () => {
  const args = tlcArgs({ jar: "j", cfg: "c", spec: "s", metadir: "m" })
  assert.deepEqual(args.slice(0, 5), [
    "-XX:+UseParallelGC",
    "-cp",
    "j",
    "tlc2.TLC",
    "-workers",
  ])
  assert.deepEqual(args.slice(5), ["1", "-metadir", "m", "-config", "c", "s"])
})

const toolchain = Boolean(resolveJava() && resolveJar())
if (!toolchain)
  process.stderr.write(
    "SKIPPED tla-specs: Java or tla2tools.jar not found (set JAVA_HOME and TLA2TOOLS). The toy spec was not model checked here.\n"
  )
const skip = toolchain
  ? false
  : "Java or tla2tools.jar not found; set JAVA_HOME and TLA2TOOLS"

function runCli(args) {
  return spawnSync(process.execPath, [join(root, "scripts/tlc.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  })
}

test(
  "tlc.mjs exits 0 on the real cfg and writes the output file",
  { skip },
  (t) => {
    const out = join(tempDir(t, "tlc-out-"), "tlc.out")
    const result = runCli([`${FIXTURE}.tla`, "--out", out])
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(readFileSync(out, "utf8"), /No error has been found/)
  }
)

test("tlc.mjs exits 12 on the mutant cfg", { skip }, (t) => {
  const out = join(tempDir(t, "tlc-out-"), "tlc.out")
  const result = runCli([`${FIXTURE}.tla`, "--mutant", "--out", out])
  assert.equal(result.status, 12, result.stdout + result.stderr)
  assert.match(readFileSync(out, "utf8"), /Invariant Inv is violated/)
})

test("tlc.mjs exits 2 when the toolchain is missing", (t) => {
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/tlc.mjs"), `${FIXTURE}.tla`],
    {
      cwd: tempDir(t, "tlc-cwd-"),
      encoding: "utf8",
      env: {
        ...process.env,
        JAVA_HOME: "/nonexistent",
        TLA2TOOLS: "/nonexistent.jar",
      },
    }
  )
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Java or tla2tools\.jar not found/)
})
