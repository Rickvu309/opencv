import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { dirname } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const exec = promisify(execFile)
const repo = dirname(dirname(fileURLToPath(import.meta.url)))

test("positions are relative to the pane's top-left, and a --driver layout is skipped by verify-pen-layout and measured by that driver", async () => {
  const ran = await exec(process.execPath, ["scripts/pen-layout.mjs"], {
    cwd: repo,
  }).then(
    (ok) => ok,
    (error) => error
  )
  assert.equal(ran.code, 1)
  assert.match(ran.stderr, /Positions are relative to the pane's top-left/)
  assert.match(
    ran.stderr,
    /A layout recorded with --driver is skipped by verify-pen-layout and measured by that driver/
  )
})
