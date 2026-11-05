import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  TLC_TIMEOUT_MS,
  allRuns,
  outFileName,
  outputOf,
  resolveJar,
  resolveJava,
  runTlc,
  statusOf,
  tlcArgs,
} from "./tlc.mjs"
import { tempDir } from "./lib/temp-dir.mjs"
import {
  exportedNames,
  expectedMutantExit,
  nextActions,
  packageResolver,
  specProblems,
} from "./lib/tla-specs.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const CLI_TIMEOUT_MS = 120_000
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

test("a map with no actions is a problem", () => {
  const files = {
    ...complete(),
    "a/Spec.tla.json": JSON.stringify({ module: "spec.mjs", actions: {} }),
  }
  assert.match(problemsOf(files)[0], /"actions" is empty/)
})

test("an action of Next with no map entry is a problem", () => {
  const tla = `${TLA}Other == x' = 0\nNext == Step \\/ Other\n`
  const problems = problemsOf({ ...complete(), "a/Spec.tla": tla })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /Other is an action of Next but has no entry/)
})

test("the actions of Next are read from every way a spec writes it", () => {
  const lines = (...body) =>
    [
      "A == x' = 1",
      "B(t) == x' = t",
      "C == x' = 3",
      "Done == UNCHANGED x",
      ...body,
      "Spec == Init",
    ].join("\n")
  assert.deepEqual(nextActions(lines("Next == A \\/ B(1) \\/ C")), [
    "A",
    "B",
    "C",
  ])
  assert.deepEqual(
    nextActions(
      lines("Next ==", "  \\/ A", "  \\/ \\E t \\in S : B(t)", "  \\/ C")
    ),
    ["A", "B", "C"]
  )
  assert.deepEqual(
    nextActions(lines("Next == A /\\ (x = 1 \\/ x = 2) \\/ UNCHANGED x")),
    ["A"]
  )
  assert.deepEqual(nextActions(lines("Next == Done \\/ A")), ["Done", "A"])
  assert.deepEqual(nextActions(lines("Init == TRUE")), [])
})

test("a map whose module is missing or whose shape is wrong is a problem", () => {
  const noModule = without(complete(), "a/spec.mjs")
  assert.match(problemsOf(noModule)[0], /module a\/spec\.mjs not found/)
  const badShape = { ...complete(), "a/Spec.tla.json": "{}" }
  assert.match(problemsOf(badShape)[0], /needs a "module"/)
  const notJson = { ...complete(), "a/Spec.tla.json": "nope" }
  assert.match(problemsOf(notJson)[0], /not valid JSON/)
})

const PACKAGE_MAP = (extra = {}) =>
  JSON.stringify({
    module: "lib-x/dist/steps.mjs",
    version: "1.2.3",
    actions: { Step: "step" },
    ...extra,
  })

const packageSpec = (map = PACKAGE_MAP()) => ({
  ...without(complete(), "a/spec.mjs"),
  "a/Spec.tla.json": map,
})

const installedAs =
  (version, text = MODULE) =>
  (dir, specifier) => {
    assert.equal(dir, "a")
    assert.equal(specifier, "lib-x/dist/steps.mjs")
    return { version, text }
  }

const packageProblems = (files, installed) =>
  specProblems(Object.keys(files), (path) => files[path], installed)

test("a map may point at a file in an installed package at the pinned version", () => {
  assert.deepEqual(packageProblems(packageSpec(), installedAs("1.2.3")), [])
})

test("a package file that does not export the function is a problem", () => {
  const problems = packageProblems(
    packageSpec(),
    installedAs("1.2.3", "export function other() {}\n")
  )
  assert.match(
    problems[0],
    /Step names step, which lib-x\/dist\/steps\.mjs does not export/
  )
})

test("an installed version that differs from the pinned one is a problem", () => {
  const problems = packageProblems(packageSpec(), installedAs("1.3.0"))
  assert.match(problems[0], /pinned to 1\.2\.3 but 1\.3\.0 is installed/)
})

test("a package that is not installed or a file it lacks is a problem", () => {
  assert.match(
    packageProblems(packageSpec(), () => null)[0],
    /package of lib-x\/dist\/steps\.mjs not installed/
  )
  assert.match(
    packageProblems(packageSpec(), () => ({ version: "1.2.3", text: null }))[0],
    /module lib-x\/dist\/steps\.mjs not found/
  )
})

test("the resolver walks up node_modules from the spec folder and reads the version", (t) => {
  const repo = tempDir(t, "tla-pkg-")
  const pkg = join(repo, "node_modules", "@scope", "lib-x")
  mkdirSync(join(pkg, "dist"), { recursive: true })
  mkdirSync(join(repo, "a", "b"), { recursive: true })
  writeFileSync(join(pkg, "package.json"), '{"version":"4.5.6"}')
  writeFileSync(join(pkg, "dist", "steps.mjs"), MODULE)
  const resolve = packageResolver(repo)
  assert.deepEqual(resolve("a/b", "@scope/lib-x/dist/steps.mjs"), {
    version: "4.5.6",
    text: MODULE,
  })
  assert.deepEqual(resolve("a/b", "@scope/lib-x/dist/none.mjs"), {
    version: "4.5.6",
    text: null,
  })
  assert.equal(resolve("a/b", "other/dist/steps.mjs"), null)
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

const repoProblems = () =>
  specProblems(
    tracked(),
    (path) => readFileSync(join(root, path), "utf8"),
    packageResolver(root)
  )

test("every spec in the repo is complete", () => {
  assert.ok(tracked().some((file) => file.endsWith(".tla")))
  assert.deepEqual(repoProblems(), [])
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

const withMutants = (mutants) => ({
  ...complete(),
  "a/Spec.release.cfg": "",
  "a/Spec.release.mutant.cfg": "",
  "a/Spec.tla.json": JSON.stringify({
    module: "spec.mjs",
    actions: { Step: "step" },
    mutants,
  }),
})

const runsOf = (files) =>
  allRuns(
    Object.keys(files).filter((file) => !file.endsWith(".mjs")),
    (path) => files[path]
  )

test("a mutant expects 12 unless the action map declares another exit", () => {
  const files = withMutants({ release: 13 })
  assert.deepEqual(
    runsOf(files).map(({ cfg, expect }) => [cfg, expect]),
    [
      ["a/Spec.cfg", 0],
      ["a/Spec.mutant.cfg", 12],
      ["a/Spec.release.cfg", 0],
      ["a/Spec.release.mutant.cfg", 13],
    ]
  )
  assert.deepEqual(
    runsOf(withMutants({})).map(({ expect }) => expect),
    [0, 12, 0, 12]
  )
})

test("the declared exit is read by the mutant's name", () => {
  const map = JSON.stringify({ mutants: { "": 13, big: 12 } })
  assert.equal(expectedMutantExit(map, "a/Spec.tla", "a/Spec.cfg"), 13)
  assert.equal(expectedMutantExit(map, "a/Spec.tla", "a/Spec.big.cfg"), 12)
  assert.equal(expectedMutantExit(map, "a/Spec.tla", "a/Spec.other.cfg"), 12)
  assert.equal(expectedMutantExit(undefined, "a/Spec.tla", "a/Spec.cfg"), 12)
})

test("a declared mutant exit other than 12 or 13 is a problem", () => {
  assert.match(
    problemsOf(withMutants({ release: 1 }))[0],
    /mutant release expects 1, which must be 12 \(invariant\) or 13 \(liveness\)/
  )
  assert.deepEqual(problemsOf(withMutants({ release: 13 })), [])
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

test("a java that cannot start puts its error in the output", () => {
  assert.match(
    outputOf({ error: new Error("spawn java EACCES"), stdout: "", stderr: "" }),
    /tlc: spawn java EACCES/
  )
  assert.equal(outputOf({ stdout: "a", stderr: "b" }), "ab")
})

test("a java that cannot start fails the run with its error", (t) => {
  const home = tempDir(t, "tlc-java-")
  mkdirSync(join(home, "bin"))
  writeFileSync(join(home, "bin", "java"), "not a program", { mode: 0o644 })
  writeFileSync(join(home, "tools.jar"), "")
  const result = runTlc({
    spec: `${FIXTURE}.tla`,
    cfg: `${FIXTURE}.cfg`,
    toolchain: { env: { JAVA_HOME: home, TLA2TOOLS: join(home, "tools.jar") } },
  })
  assert.equal(result.code, 1)
  assert.match(result.output, /tlc: spawnSync .*EACCES/)
})

test("every tlc run is bounded by a timeout", () => {
  assert.ok(TLC_TIMEOUT_MS > 0 && TLC_TIMEOUT_MS <= 30 * 60 * 1000)
})

test("two specs with the same cfg name write different output files", () => {
  const first = outFileName("a/b/One.tla", "a/b/Spec.cfg")
  const second = outFileName("a/c/Two.tla", "a/c/Spec.cfg")
  assert.notEqual(first, second)
  assert.equal(first, "a__b__Spec.out")
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
    timeout: CLI_TIMEOUT_MS,
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
      timeout: CLI_TIMEOUT_MS,
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
