import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { UsageError } from "../args.mjs"
import { SWEEP_COMMAND } from "./command.mjs"

const repo = fileURLToPath(new URL("../../..", import.meta.url))

const ctx = () => ({
  repo,
  scratchRoot: "/scratch/ocv-ui-none",
  fs: {
    read: (path) => readFileSync(path, "utf8"),
    exists: () => false,
  },
  proc: { alive: () => false },
})

test("the sweep takes seeded accounts unless told otherwise, and refuses an unknown account source before it opens a browser", async () => {
  await assert.rejects(
    SWEEP_COMMAND.run(ctx(), {
      positional: ["screen", "paper-home"],
      flags: { accounts: "shared" },
    }),
    (error) =>
      error instanceof UsageError &&
      /--accounts takes seeded or pooled, got shared/.test(error.message)
  )
  for (const accounts of [undefined, "seeded", "pooled"])
    await assert.rejects(
      SWEEP_COMMAND.run(ctx(), {
        positional: ["screen", "paper-home"],
        flags: accounts ? { accounts } : {},
      }),
      /no running app for this worktree/
    )
  assert.match(SWEEP_COMMAND.usage, /\[--accounts seeded\|pooled\]/)
  assert.ok(SWEEP_COMMAND.options.valued.includes("accounts"))
})
