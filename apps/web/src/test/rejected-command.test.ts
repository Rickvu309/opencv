// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  findDroppedRejections,
  type SourceFile,
} from "./rejected-command-scan.ts"

const srcDir = fileURLToPath(new URL("..", import.meta.url))

function sourceFiles(dir: string): SourceFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "test" ? [] : sourceFiles(full)
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      return []
    }
    return [
      { name: path.relative(srcDir, full), text: readFileSync(full, "utf8") },
    ]
  })
}

function scan(text: string) {
  return findDroppedRejections([{ name: "sample.tsx", text }]).map(
    (finding) => finding.call
  )
}

describe("every rejected command shows an error", () => {
  it("shows an error for every rejected command", () => {
    const hits = findDroppedRejections(sourceFiles(srcDir)).map(
      (finding) => `${finding.file}:${finding.line} ${finding.call}`
    )
    expect(hits).toEqual([])
  })

  it("flags a command whose rejection is voided", () => {
    expect(
      scan(`const run = useRunCommand()
function A() { return <b onClick={() => void run("job.star", {})} /> }`)
    ).toEqual(["run"])
  })

  it("flags a bare call and a then with no catch", () => {
    expect(
      scan(`const run = useRunCommand()
function A() { run("a", {}); void run("b", {}).then(() => 1) }`)
    ).toEqual(["run", "run"])
  })

  it("flags a swallowing catch", () => {
    expect(
      scan(`const run = useRunCommand()
function A() { void run("a", {}).catch(() => undefined) }`)
    ).toEqual(["run"])
  })

  it("flags a voided call to a local async function that rejects", () => {
    expect(
      scan(`const run = useRunCommand()
function A() {
  async function go() { await run("a", {}) }
  return <b onClick={() => void go()} />
}`)
    ).toEqual(["go"])
  })

  it("flags an async event handler with an unprotected await", () => {
    expect(
      scan(`const run = useRunCommand()
function A() { return <b onClick={async () => { await run("a", {}) }} /> }`)
    ).toEqual(["run"])
  })

  it("flags a voided call to an exported wrapper in another file", () => {
    const hits = findDroppedRejections([
      {
        name: "api.ts",
        text: `export function drop(q) { return runContractCommand(q, "x", {}) }`,
      },
      { name: "use.tsx", text: `function A() { void drop(q) }` },
    ])
    expect(hits.map((hit) => hit.call)).toEqual(["drop"])
  })

  it("accepts handled rejections", () => {
    expect(
      scan(`const run = useRunCommand()
async function a() { try { await run("a", {}) } catch { setError("no") } }
function b() { void run("b", {}).catch((e) => toast(String(e))) }
function c() { return run("c", {}) }
const d = async () => { await run("d", {}) }
function e() { void run("e", {}).then(ok, fail) }
function f() { return <b onClick={() => void d().catch(show)} /> }`)
    ).toEqual([])
  })

  it("accepts a command wrapped in ignoreRejection with a reason", () => {
    expect(
      scan(`import { ignoreRejection } from "@/lib/quiet-rejection"
const run = useRunCommand()
async function A() {
  void ignoreRejection(run("a", {}), "stopAfterAbortIsHarmless")
  await ignoreRejection(run("b", {}), "welcomeRetriesOnNextLoad")
  const made = await ignoreRejection(run("c", {}), "failedCreateLeavesPanelClosed")
  void ignoreRejection(run("d", {}), "stopAfterAbortIsHarmless").finally(stop)
}`)
    ).toEqual([])
  })

  it("accepts the wrapper imported under another local name", () => {
    expect(
      scan(`import { ignoreRejection as quiet } from "./quiet-rejection"
const run = useRunCommand()
function A() { void quiet(run("a", {}), "stopAfterAbortIsHarmless") }`)
    ).toEqual([])
  })

  it("flags a command handed to any other function that is then dropped", () => {
    expect(
      scan(`const run = useRunCommand()
function A() { void anything(run("a", {})) }`)
    ).toEqual(["run"])
    expect(
      scan(`const run = useRunCommand()
function A() { return <b onClick={async () => { await anything(run("a", {})) }} /> }`)
    ).toEqual(["run"])
  })

  it("flags a local function that only shares the wrapper's name", () => {
    expect(
      scan(`const run = useRunCommand()
const ignoreRejection = (p, why) => p
function A() { void ignoreRejection(run("a", {}), "stopAfterAbortIsHarmless") }`)
    ).toEqual(["run"])
  })

  it("flags the wrapper imported from some other module", () => {
    expect(
      scan(`import { ignoreRejection } from "./elsewhere"
const run = useRunCommand()
function A() { void ignoreRejection(run("a", {}), "stopAfterAbortIsHarmless") }`)
    ).toEqual(["run"])
  })

  it("flags a command another function awaited whose caller drops it", () => {
    expect(
      scan(`const run = useRunCommand()
async function save() { await anything(run("a", {})) }
function A() { void save() }`)
    ).toEqual(["save"])
  })

  it("flags a swallowed command even when a note sits above the call", () => {
    expect(
      scan(`const run = useRunCommand()
function A() {
  // best effort cleanup
  void run("a", {}).catch(() => undefined)
}`)
    ).toEqual(["run"])
  })
})
