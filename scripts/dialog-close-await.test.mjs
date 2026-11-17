import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/dialog-close-await.mjs"

const SEARCH = "apps/web/src/features/app-shell/app-shell-search.test.tsx"
const INTRODUCED = "b58217df8a92a778516641084605bf20cad2d1c0"
const CLOSE = 'fireEvent.keyDown(window, { key: "k", ctrlKey: true })'
const ABSENT = 'expect(screen.queryByRole("dialog")).not.toBeInTheDocument()'

test("dialog close assertions wait for exit completion", () => {
  assert.equal(detect(`async () => { ${CLOSE}; ${ABSENT} }`).length, 1)
  assert.equal(
    detect(`async () => { fireEvent.click(close); ${ABSENT} }`).length,
    1
  )
  assert.deepEqual(
    detect(`async () => { ${CLOSE}; await waitFor(() => { ${ABSENT} }) }`),
    []
  )
  assert.deepEqual(detect(`() => { ${ABSENT} }`), [])
  assert.deepEqual(
    detect(
      `() => { ${CLOSE}; expect(screen.getByRole("dialog")).toBeVisible() }`
    ),
    []
  )
})

test("the search test's introducing commit checks absence before exit settles", () => {
  const historic = execFileSync("git", ["show", `${INTRODUCED}:${SEARCH}`], {
    encoding: "utf8",
  })
  assert.equal(detect(historic, SEARCH).length, 1)
})

test("app shell dialog closes await removal", () => {
  const files = execFileSync(
    "git",
    ["ls-files", "--", "apps/web/src/features/app-shell/*.test.tsx"],
    { encoding: "utf8" }
  )
    .trim()
    .split("\n")
  assert.ok(files.includes(SEARCH))
  assert.deepEqual(
    files.flatMap((file) => detect(readFileSync(file, "utf8"), file)),
    []
  )
})
