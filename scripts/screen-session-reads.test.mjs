import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/screen-session-reads.mjs"

const root = new URL("../", import.meta.url)

test("a screen that asks the server for the session again is caught", () => {
  for (const mistake of [
    `async function openLab() { const check = await checkSession() }`,
    `useEffect(() => { void checkSession().then(show) }, [])`,
    `async function open() { return authClient.getSession() }`,
    `async function open() { return sessions.checkSession() }`,
  ])
    assert.notDeepEqual(
      detect(mistake, "apps/web/src/routes/lab.tsx"),
      [],
      mistake
    )
})

test("reusing the loaded session or asking from a route guard stays quiet", () => {
  for (const clean of [
    `async function openLab() { const check = await loadedSessionCheck() }`,
    `const session = authClient.useSession()`,
    `export { checkSession } from "./session-check.ts"`,
  ])
    assert.deepEqual(detect(clean, "apps/web/src/routes/lab.tsx"), [], clean)
  assert.deepEqual(
    detect(
      `beforeLoad: async () => { const check = await checkSession() }`,
      "apps/web/src/router.tsx"
    ),
    []
  )
})

test("no web screen asks the server for the session again", () => {
  const files = execFileSync("git", ["ls-files", "apps/web/src"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(
      (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$|\/test\//.test(file)
    )
  assert.ok(files.length > 100)
  const problems = files.flatMap((file) =>
    detect(readFileSync(new URL(file, root), "utf8"), file)
  )
  assert.deepEqual(problems, [])
})
