import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  SESSION_CHECK_SOURCE,
  detectDirectSessionRead as detect,
} from "./lib/session-check-reads.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const INTRODUCED = "765f384b"
const ROUTER = "apps/web/src/router.tsx"

const mistake = `
const productLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "product",
  beforeLoad: async ({ location }) => {
    try {
      const { data } = await authClient.getSession()
      if (!data) {
        throw redirect({ href: signInHref(locationHref(location)) })
      }
      return { session: data }
    } catch (error) {
      if (isRedirect(error)) throw error
      return { session: null }
    }
  },
})
`

const clean = `
async function requireSession(resumeHref: string) {
  const check = await checkSession()
  if (check.kind === "signed-out")
    throw redirect({ href: signInHref(resumeHref) })
  const session = sessionToKeep(check)
  if (!session) throw new SessionCheckUnknown()
  return { session, sessionCheck: check.kind }
}
`

test("a sign-in redirect that reads the session reply directly fires, and a redirect on the parsed signed-out check stays quiet", () => {
  assert.equal(detect(mistake, ROUTER).length, 1)
  assert.deepEqual(detect(clean, ROUTER), [])
  assert.deepEqual(detect(mistake, SESSION_CHECK_SOURCE), [])
  assert.deepEqual(detect(mistake, "apps/web/src/test/auth-client-mock.ts"), [])
  assert.deepEqual(detect(mistake, "apps/api/src/auth.ts"), [])
})

test("the router at the commit that gated the app behind sign-in fires", () => {
  const past = execFileSync("git", ["show", `${INTRODUCED}:${ROUTER}`], {
    cwd: root,
    encoding: "utf8",
  })
  assert.ok(detect(past, ROUTER).length > 0)
})

test("no web source reads the session reply outside the session check", () => {
  const files = execFileSync("git", ["ls-files", "apps/web/src"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
  const hits = files.flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8"), file).map(
      (hit) => `${file}:${hit.line} ${hit.text}`
    )
  )
  assert.deepEqual(hits, [])
})
