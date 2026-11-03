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

  it("accepts a rejected-ok marker on the call's line, the line above it, or inside the empty catch", () => {
    expect(
      scan(`const run = useRunCommand()
function A() {
  // rejected-ok: best effort cleanup
  void run("a", {}).catch(() => undefined)
  run("b", {}).catch(() => {
    // rejected-ok: the next load tries again
  })
}`)
    ).toEqual([])
  })
})
