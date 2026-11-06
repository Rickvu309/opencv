import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/root-redirect-warmup.mjs"

const redirect = `const { router } = renderApp("/")
await waitFor(() => expect(router.state.location.pathname).toBe("/apply"))`

test("rejects cold root redirects whose URL changes before their lazy destination loads", () => {
  assert.equal(detect(redirect).length, 1)
})

test("accepts warmed redirects and signed-out landing assertions", () => {
  assert.deepEqual(detect(`import "@/test/warm-routes.ts"\n${redirect}`), [])
  assert.deepEqual(
    detect(`renderApp("/")\nexpect(router.state.location.pathname).toBe("/")`),
    []
  )
  assert.deepEqual(detect(`renderApp("/apply")`), [])
})

test("root redirect suites warm their destination imports before test execution", () => {
  const files = execFileSync("git", ["ls-files", "apps/web/src"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => /\.test\.tsx?$/.test(file))
  const failures = files.flatMap((file) =>
    detect(readFileSync(file, "utf8")).map((message) => `${file}: ${message}`)
  )
  assert.deepEqual(failures, [])
})
