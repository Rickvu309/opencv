import assert from "node:assert/strict"
import test from "node:test"
import { claimMarker } from "../claim-marker.mjs"
import { minutesAgo } from "../ports/fake.mjs"
import { receiptPath } from "./affected-tests.mjs"
import { readFileSync } from "node:fs"

export function detect(effects) {
  const push = effects.findIndex((effect) => effect.op === "push")
  if (push < 0) return []
  const before = effects.slice(0, push)
  const check = before.findIndex(
    (effect) =>
      effect.op === "proc" &&
      effect.cmd === "node" &&
      effect.args.at(-1) === "check"
  )
  const receipt = before.findIndex(
    (effect) => effect.op === "receipt" && effect.passed
  )
  return check >= 0 && receipt > check ? [] : ["push without a checked receipt"]
}

async function saving({
  checkOk = true,
  record = true,
  ahead = false,
  stale = false,
} = {}) {
  const { fixture } = await import("./fixture.mjs")
  const w = fixture({
    env: { OCV_TOOLS_AGENT: "me" },
    affectedReceipts: false,
    intercept(cmd, args) {
      if (cmd !== "node" || args.at(-1) !== "check") return null
      if (record)
        w.ports.fs.write(
          receiptPath(
            w.ports.git.here(w.ctx.cwd).gitDir,
            stale ? "old-head" : "base-1",
            "tree-1"
          ),
          "pass"
        )
      return { ok: checkOk, out: "", err: checkOk ? "" : "test failed" }
    },
  })
  const state = w.ports.state
  state.issues.get(90).comments.push({
    databaseId: 7,
    createdAt: minutesAgo(10),
    updatedAt: minutesAgo(10),
    body: claimMarker({ agent: "me", at: "client", branch: state.branch }),
  })
  if (ahead) state.ahead[w.ctx.cwd] = 1
  else state.dirty[w.ctx.cwd] = " M scripts/a.mjs"
  const exists = w.ports.fs.exists
  w.ports.fs.exists = (path) => {
    const passed = exists(path)
    if (path.includes("/ocv-tools-affected-tests-"))
      w.ports.effects.push({ op: "receipt", passed })
    return passed
  }
  return w
}

test("save checks and validates the head receipt before opening git push, including an already committed head", async () => {
  for (const ahead of [false, true]) {
    const w = await saving({ ahead })
    const result = w.call("save", "-m", "fix: keep the connection short")
    assert.equal(result.code, 0, result.text)
    assert.equal(
      w.ports.effects.some((effect) => effect.op === "push"),
      true
    )
    assert.deepEqual(detect(w.ports.effects), [])
    assert.match(result.text, /git push connection window: 0.000s/)
  }
})

test("save never pushes after a failed check, missing receipt or receipt for another head", async () => {
  for (const options of [
    { checkOk: false },
    { record: false },
    { stale: true },
  ]) {
    const w = await saving(options)
    const result = w.call("save", "-m", "fix: keep the connection short")
    assert.notEqual(result.code, 0, result.text)
    assert.equal(
      w.ports.effects.some((effect) => effect.op === "push"),
      false
    )
    assert.match(
      result.text,
      /Checks failed before push|No recorded pass for HEAD/
    )
  }
})

test("the old ordering and an unchecked successful command fire; check then receipt then push stays quiet", () => {
  const check = { op: "proc", cmd: "node", args: ["ocv-tools.mjs", "check"] }
  const receipt = { op: "receipt", passed: true }
  const push = { op: "push" }
  assert.deepEqual(detect([push, check, receipt]), [
    "push without a checked receipt",
  ])
  assert.deepEqual(detect([check, push]), ["push without a checked receipt"])
  assert.deepEqual(detect([check, receipt, push]), [])
})

export function detectSource(source) {
  const save = source.slice(
    source.indexOf("export function save("),
    source.indexOf("function workOf(")
  )
  const push = save.indexOf("git.push(")
  const check = save.indexOf('"check"]')
  const receipt = save.indexOf("if (!hasReceipt(")
  return push >= 0 && check >= 0 && check < receipt && receipt < push
    ? []
    : ["push before checked receipt"]
}

test("save source keeps the check and receipt gate ahead of git push", () => {
  const source = readFileSync(new URL("../work.mjs", import.meta.url), "utf8")
  assert.deepEqual(detectSource(source), [])
  assert.deepEqual(
    detectSource("export function save() { git.push(ctx.cwd) }"),
    ["push before checked receipt"]
  )
})
