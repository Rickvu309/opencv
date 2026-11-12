import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  APP_FILE,
  LIMIT_FILE,
  ROUTES_FILE,
  detect,
} from "./lib/auth-email-limit-mount.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const AUTH_FILE = "apps/api/src/auth.ts"
const HEADER_KEYED_MAIN = "b8a5ea70"

const atRev = (rev) => ({
  read(name) {
    try {
      return execFileSync("git", ["show", `${rev}:${name}`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 30_000,
      })
    } catch {
      return null
    }
  },
})

const fromFiles = (files) => ({ read: (name) => files[name] ?? null })

const current = (name) => readFileSync(path.join(root, name), "utf8")

test("auth keyed on a client address header with no per-email limit mounted fires", () => {
  const mistake = atRev(HEADER_KEYED_MAIN)
  const problems = detect(mistake.read(AUTH_FILE), AUTH_FILE, mistake)
  assert.ok(
    problems.some((line) => line.includes("mounts no per-email limit")),
    problems.join("\n")
  )
  assert.ok(
    problems.some((line) =>
      line.includes("/email-otp/send-verification-otp sends a sign-in code")
    ),
    problems.join("\n")
  )
})

test("the same auth with the per-email limit mounted before the handler stays quiet", () => {
  assert.deepEqual(detect(current(AUTH_FILE), AUTH_FILE), [])
})

test("a limit mounted after the auth handler fires", () => {
  const app = current(APP_FILE)
  const mount = app.slice(
    app.search(/app\.use\(\s*"\/api\/auth\/\*",\s*authEmailLimit\(/),
    app.search(/app\.all\(\s*"\/api\/auth\/\*"/)
  )
  const moved = app.replace(mount, "") + `\n${mount}\n`
  const io = fromFiles({
    [APP_FILE]: moved,
    [ROUTES_FILE]: current(ROUTES_FILE),
    [LIMIT_FILE]: current(LIMIT_FILE),
  })
  assert.deepEqual(detect(current(AUTH_FILE), AUTH_FILE, io), [
    `${APP_FILE} mounts the per-email limit after the auth handler, so it never runs`,
  ])
})

test("a newly served code-sending route the limit does not list fires", () => {
  const io = fromFiles({
    [APP_FILE]: current(APP_FILE),
    [ROUTES_FILE]: current(ROUTES_FILE).replace(
      '"/email-otp/change-email",',
      '"/email-otp/change-email",\n  "/email-otp/request-password-reset",'
    ),
    [LIMIT_FILE]: current(LIMIT_FILE).replace(
      '["/email-otp/request-password-reset", "email"],',
      ""
    ),
  })
  assert.deepEqual(detect(current(AUTH_FILE), AUTH_FILE, io), [
    `/email-otp/request-password-reset sends a sign-in code and ${LIMIT_FILE} does not limit it per email`,
  ])
})

test("auth that reads no client address header stays quiet", () => {
  assert.deepEqual(
    detect(
      current(AUTH_FILE).replace(/ipAddress: \{[^}]*\},/, ""),
      AUTH_FILE,
      fromFiles({})
    ),
    []
  )
})
