import assert from "node:assert/strict"
import test from "node:test"
import { changeFacts, deletedFacts } from "./pull-facts.mjs"

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

function prMarksItsOwnFilesGenerated() {
  const attributeReads = []
  return {
    attributeReads,
    cwd: "/repo",
    ports: {
      proc: {
        run(cmd, args) {
          if (args[0] === "check-attr") {
            attributeReads.push(args)
            const paths = args.slice(args.indexOf("--") + 1)
            const out = args.includes("--source=base")
              ? ""
              : paths
                  .map((path) => `${path}: linguist-generated: set`)
                  .join("\n")
            return { ok: true, out, err: "" }
          }
          if (args.includes("ls-tree"))
            return { ok: true, out: "huge.ts\0kept.ts\0", err: "" }
          if (args.includes("--diff-filter=D") && args.includes("--numstat"))
            return { ok: true, out: "0\t3000\thuge.ts\0", err: "" }
          if (args.includes("--diff-filter=D"))
            return { ok: true, out: "huge.ts\0", err: "" }
          if (args.includes("--numstat"))
            return { ok: true, out: "4000\t0\thuge.ts\0", err: "" }
          return { ok: true, out: "", err: "" }
        },
      },
    },
  }
}

test("a pull request cannot exempt itself: generated marks come from the base revision's attributes", () => {
  const ctx = prMarksItsOwnFilesGenerated()
  assert.deepEqual(changeFacts(ctx, "base", "head"), [
    { path: "huge.ts", added: 4000, deleted: 0, generated: false },
  ])
  assert.deepEqual(deletedFacts(ctx, "base", "head"), {
    files: 1,
    lines: 3000,
    total: 2,
  })
  assert.ok(ctx.attributeReads.length > 0)
  for (const args of ctx.attributeReads)
    assert.ok(args.includes("--source=base"), args.join(" "))
})
