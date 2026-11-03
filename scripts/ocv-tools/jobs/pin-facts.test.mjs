import assert from "node:assert/strict"
import test from "node:test"
import { pinFacts } from "./pin-facts.mjs"

const HEAD_FILES = {
  "apps/api/src/registry/a.test.ts":
    'it.fails(\n  "#758: a lost race replays the winner",\n  async () => {}\n)\nit.fails(`${KNOWN.issue}: pinned`, () => {})\nit.fails("no issue here", () => {})\n',
  "apps/api/src/test/known.ts": 'export const KNOWN = { issue: "#12" }\n',
  "apps/api/src/registry/registry.ts": 'const note = "it.fails #9"\n',
}

function fakeCtx({ files = HEAD_FILES, grep } = {}) {
  const calls = []
  const ok = (out) => ({ ok: true, out, err: "" })
  return {
    calls,
    cwd: "/repo",
    ports: {
      proc: {
        run(cmd, args) {
          calls.push([cmd, ...args])
          if (cmd === "git" && args[0] === "grep") {
            if (grep) return grep
            const pattern = new RegExp(args[3].replace("[[:space:]]", "\\s"))
            const hits = Object.entries(files)
              .filter(([, text]) => pattern.test(text))
              .map(([path]) => `${args[4]}:${path}`)
            return hits.length
              ? ok(hits.join("\n"))
              : { ok: false, out: "", err: "" }
          }
          if (cmd === "git" && args[0] === "show")
            return ok(files[args[1].slice(args[1].indexOf(":") + 1)])
          if (cmd === "gh" && args[0] === "issue")
            return args[2] === "404"
              ? { ok: false, out: "", err: "not found" }
              : ok(
                  JSON.stringify({
                    state: args[2] === "12" ? "OPEN" : "CLOSED",
                  })
                )
          throw new Error(`unscripted ${cmd} ${args.join(" ")}`)
        },
      },
    },
  }
}

test("pinFacts reads every expected failure in the head's test sources with its issue state", () => {
  const ctx = fakeCtx()
  assert.deepEqual(pinFacts(ctx, "head-1"), [
    { at: "apps/api/src/registry/a.test.ts:1", issue: 758, state: "CLOSED" },
    { at: "apps/api/src/registry/a.test.ts:5", issue: 12, state: "OPEN" },
    { at: "apps/api/src/registry/a.test.ts:6", issue: null, state: null },
  ])
  const views = ctx.calls.filter(([cmd]) => cmd === "gh")
  assert.deepEqual(
    views.map((call) => call[3]),
    ["758", "12"]
  )
  assert.ok(
    ctx.calls.every(
      ([cmd, ...args]) =>
        cmd !== "git" ||
        args[0] !== "grep" ||
        args.slice(-2).join(" ") === "apps packages"
    )
  )
})

test("pinFacts reads nothing more when no test pins a failure, and fails loudly when git grep breaks", () => {
  const ctx = fakeCtx({
    files: { "apps/a.test.ts": 'it("passes", () => {})\n' },
  })
  assert.deepEqual(pinFacts(ctx, "head-1"), [])
  assert.equal(ctx.calls.length, 1)
  const missing = fakeCtx({
    files: { "apps/a.test.ts": 'it.fails("#404: gone", () => {})\n' },
  })
  assert.deepEqual(pinFacts(missing, "head-1"), [
    { at: "apps/a.test.ts:1", issue: 404, state: "MISSING" },
  ])
  const broken = fakeCtx({
    grep: { ok: false, out: "", err: "fatal: bad object" },
  })
  assert.throws(
    () => pinFacts(broken, "head-1"),
    /git grep failed: fatal: bad object/
  )
})
