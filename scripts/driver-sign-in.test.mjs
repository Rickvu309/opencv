import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  SHARED_HELPER,
  SIGN_IN_UI_DRIVERS,
  isDriverFile,
  ownSignIns,
  signInProblems,
} from "./lib/driver-sign-in.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const driverFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(
      (file) => file && isDriverFile(file) && existsSync(path.join(root, file))
    )

const MISTAKE = `await page.evaluate(\`fetch('/api/auth/email-otp/send-verification-otp', { method: 'POST' })\`)
await page.evaluate("document.querySelector('#sign-in-email')")`

test("a driver that calls the code endpoints or fills the sign-in form itself is flagged", () => {
  assert.deepEqual(ownSignIns(MISTAKE), [
    "the send-code endpoint",
    "the email code endpoints",
    "the sign-in form email field",
  ])
  assert.equal(signInProblems("scripts/verify-x.mjs", MISTAKE).length, 3)
})

test("a driver that calls the shared helper passes", () => {
  const fixed = `import { signInThrowaway } from "./lib/session.mjs"\nawait signInThrowaway({ page, apiUrl, logPath })`
  assert.deepEqual(signInProblems("scripts/verify-x.mjs", fixed), [])
})

test("the shared helper and the sign-in screen drivers may reach the endpoints", () => {
  assert.deepEqual(signInProblems(SHARED_HELPER, MISTAKE), [])
  for (const file of Object.keys(SIGN_IN_UI_DRIVERS))
    assert.deepEqual(signInProblems(file, MISTAKE), [])
})

test("every sign-in screen driver is still in the repo and says why it is allowed", () => {
  for (const [file, reason] of Object.entries(SIGN_IN_UI_DRIVERS)) {
    assert.ok(
      existsSync(path.join(root, file)),
      `${file} is gone; drop its row`
    )
    assert.ok(reason.length > 10)
  }
  assert.ok(existsSync(path.join(root, SHARED_HELPER)))
})

test("no verify driver signs in on its own", () => {
  const files = driverFiles()
  assert.ok(files.length > 10)
  const problems = files.flatMap((file) =>
    signInProblems(file, readFileSync(path.join(root, file), "utf8"))
  )
  assert.deepEqual(problems, [])
})
