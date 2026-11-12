import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  APP_FILE,
  LIMIT_FILE,
  detect,
} from "./lib/oauth-client-limit-mount.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const AUTH_FILE = "apps/api/src/auth.ts"
const OPEN_REGISTRATION_INTRODUCED = "433f74956fea62e921461475a4631aa12028e988"

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

test("open agent client registration with only an address-keyed limit fires", () => {
  const mistake = atRev(OPEN_REGISTRATION_INTRODUCED)
  const problems = detect(mistake.read(AUTH_FILE), AUTH_FILE, mistake)
  assert.ok(
    problems.some((line) => line.includes("mounts no client limit")),
    problems.join("\n")
  )
  assert.ok(
    problems.some((line) => line.includes(`${LIMIT_FILE} is missing`)),
    problems.join("\n")
  )
})

test("the same registration with the client limit mounted before the handler stays quiet", () => {
  assert.deepEqual(detect(current(AUTH_FILE), AUTH_FILE), [])
})

test("auth without open registration stays quiet", () => {
  const closed = current(AUTH_FILE).replace(
    /allowUnauthenticatedClientRegistration:\s*true/,
    "allowUnauthenticatedClientRegistration: false"
  )
  assert.deepEqual(detect(closed, AUTH_FILE, fromFiles({})), [])
})

test("a client limit mounted after the auth handler fires", () => {
  const app = current(APP_FILE)
  const mount = app.slice(
    app.search(
      / {2}if \(auth && database\)\n {4}app\.use\(\s*"\/api\/auth\/oauth2\/\*"/
    ),
    app.search(/app\.all\(\s*"\/api\/auth\/\*"/)
  )
  assert.ok(mount.includes("oauthClientLimit("))
  const moved = `${app.replace(mount, "")}\n${mount}`
  const problems = detect(
    current(AUTH_FILE),
    AUTH_FILE,
    fromFiles({ [APP_FILE]: moved, [LIMIT_FILE]: current(LIMIT_FILE) })
  )
  assert.ok(
    problems.some((line) => line.includes("after the auth handler")),
    problems.join("\n")
  )
})

test("a client limit keyed on a client address fires", () => {
  const keyed = `${current(LIMIT_FILE)}\nconst key = (c) => c.req.header("x-real-ip")\n`
  const problems = detect(
    current(AUTH_FILE),
    AUTH_FILE,
    fromFiles({ [APP_FILE]: current(APP_FILE), [LIMIT_FILE]: keyed })
  )
  assert.ok(
    problems.some((line) => line.includes("reads a client address")),
    problems.join("\n")
  )
})

test("a client limit that skips a client-creating route or a bound fires", () => {
  const skipped = current(LIMIT_FILE)
    .replace('"/api/auth/oauth2/public-client-prelogin",', "")
    .replace(/pendingHours: \d+/, "pendingHours: hours")
  const problems = detect(
    current(AUTH_FILE),
    AUTH_FILE,
    fromFiles({ [APP_FILE]: current(APP_FILE), [LIMIT_FILE]: skipped })
  )
  assert.ok(
    problems.some((line) => line.includes("public-client-prelogin can create")),
    problems.join("\n")
  )
  assert.ok(
    problems.some((line) => line.includes("sets no pendingHours bound")),
    problems.join("\n")
  )
})
