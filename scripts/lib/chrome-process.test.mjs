import assert from "node:assert/strict"
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import {
  launchChrome,
  startDeadlineFor,
  startLogTail,
} from "./chrome-process.mjs"
import { makeTempDir } from "./temp-dir.mjs"

const DBUS_LINE =
  '[2405:2424:1103/035350.068319:ERROR:dbus/bus.cc:405] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")'

test("Chrome gets a longer start budget on CI than on a laptop", () => {
  assert.equal(startDeadlineFor({}), 20000)
  assert.equal(startDeadlineFor({ CI: "" }), 20000)
  assert.equal(startDeadlineFor({ CI: "false" }), 20000)
  assert.equal(startDeadlineFor({ CI: "0" }), 20000)
  assert.equal(startDeadlineFor({ CI: "true" }), 60000)
  assert.equal(startDeadlineFor({ CI: "1" }), 60000)
})

test("the start log drops dbus connection noise and keeps real errors", () => {
  const sandbox =
    "[1:1:1103/035350.1:FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox!"
  const log = [DBUS_LINE, DBUS_LINE, sandbox, DBUS_LINE, ""].join("\n")
  assert.equal(
    startLogTail(log),
    `${sandbox} (3 dbus connection lines dropped)`
  )
  assert.equal(startLogTail(`${sandbox}\n`), sandbox)
  assert.equal(
    startLogTail([DBUS_LINE, DBUS_LINE].join("\n")),
    "(2 dbus connection lines dropped)"
  )
})

const silentStarts = async (env) => {
  const scratch = path.join(homedir(), "tmp")
  mkdirSync(scratch, { recursive: true })
  const dir = makeTempDir("chrome-budget-", scratch)
  const fake = path.join(dir, "silent-chrome.sh")
  writeFileSync(
    fake,
    ["#!/bin/sh", `echo '${DBUS_LINE}' >&2`, "exec sleep 30"].join("\n")
  )
  chmodSync(fake, 0o755)
  const budgets = []
  const timers = {
    start: (fire, ms) => {
      budgets.push(ms)
      queueMicrotask(fire)
      return budgets.length
    },
    stop: () => {},
  }
  try {
    const error = await launchChrome({
      name: "chrome-budget-test",
      env: { ...process.env, ...env, CHROME_BIN: fake },
      timers,
    }).then(
      () => assert.fail("a silent Chrome must not count as started"),
      (rejected) => rejected
    )
    return { budgets, error }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("on CI each silent start waits 60 s and is retried once", async () => {
  const { budgets, error } = await silentStarts({ CI: "true" })
  assert.deepEqual(budgets, [60000, 60000])
  assert.match(error.message, /^chrome did not start after 60000 ms/)
})

test("on a laptop each silent start waits 20 s and is retried once", async () => {
  const { budgets, error } = await silentStarts({ CI: "" })
  assert.deepEqual(budgets, [20000, 20000])
  assert.match(error.message, /^chrome did not start after 20000 ms/)
})
