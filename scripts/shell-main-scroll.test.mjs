import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/shell-main-scroll.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const SHELL = "apps/web/src/features/app-shell/app-shell.tsx"

const shellWith = (
  className
) => `<FocusSafeRegion className="flex min-h-0 flex-1 overflow-hidden">
  <main
    id="app-main"
    tabIndex={-1}
    className="${className}"
  >
    <Outlet />
  </main>
</FocusSafeRegion>`

test("a main card that clips its page fires", () => {
  const found = detect(
    shellWith(
      "h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit] outline-none"
    )
  )
  assert.equal(found.length, 1)
  assert.match(found[0].why, /overflow-hidden/)
})

test("a main card with no overflow rule fires, since the region around it clips", () => {
  assert.equal(detect(shellWith("h-full min-h-0 flex-1")).length, 1)
})

test("a later clip wins over an earlier scroll", () => {
  assert.equal(
    detect(shellWith("h-full overflow-y-auto overflow-y-hidden")).length,
    1
  )
})

test("a main card that scrolls its page stays quiet", () => {
  assert.deepEqual(
    detect(
      shellWith(
        "h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-[inherit] outline-none"
      )
    ),
    []
  )
  assert.deepEqual(detect(shellWith("h-full overflow-auto")), [])
})

test("the shell's main card scrolls every page that is taller than the window", () => {
  const found = detect(readFileSync(path.join(root, SHELL), "utf8"))
  assert.deepEqual(
    found.map((item) => `${SHELL}:${item.line} ${item.why}`),
    []
  )
})
