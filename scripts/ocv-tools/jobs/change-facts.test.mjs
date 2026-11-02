import assert from "node:assert/strict"
import test from "node:test"
import { changeFacts } from "./pull-facts.mjs"

const numstat = [
  "0\t20\ta3.ts",
  "0\t0\t\0old.ts\0new.ts",
  "1\t0\t\0before.ts\0after.ts",
  "-\t-\tlogo.png",
  "5\t2\tpnpm-lock.yaml",
  "",
].join("\0")

function fakeCtx() {
  const calls = []
  return {
    calls,
    cwd: "/repo",
    ports: {
      proc: {
        run(cmd, args) {
          calls.push(args)
          if (args.includes("--numstat"))
            return { ok: true, out: numstat, err: "" }
          return {
            ok: true,
            out: "pnpm-lock.yaml: linguist-generated: set",
            err: "",
          }
        },
      },
    },
  }
}

test("changeFacts reads deletions, renames, binaries and generated files from one numstat", () => {
  const ctx = fakeCtx()
  assert.deepEqual(changeFacts(ctx, "base", "head"), [
    { path: "a3.ts", added: 0, deleted: 20, generated: false },
    { path: "new.ts", added: 0, deleted: 0, generated: false },
    { path: "after.ts", added: 1, deleted: 0, generated: false },
    { path: "logo.png", added: 0, deleted: 0, generated: false },
    { path: "pnpm-lock.yaml", added: 5, deleted: 2, generated: true },
  ])
  assert.ok(ctx.calls[0].includes("-M"))
})
