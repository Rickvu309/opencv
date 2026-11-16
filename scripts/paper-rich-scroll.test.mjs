import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-rich-scroll.mjs"

const pagePath = "apps/web/src/features/paper/rich-page.tsx"
const barPath = "apps/web/src/features/paper/rich-find-bar.tsx"
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const past = (rev, path) =>
  execFileSync("git", ["show", `${rev}:${path}`], { encoding: "utf8" })

const bounded =
  '<section className="rich-paper-page flex h-full min-h-0 flex-col overflow-clip"><div data-paper-document-pane="" className="min-h-0 flex-1 overflow-auto"></div></section>'

test("Rich Paper page stays height-bounded and the document pane scrolls", () => {
  assert.deepEqual(detect(bounded, pagePath), [])
  assert.deepEqual(
    detect(
      bounded.replace("overflow-clip", "overflow-y-auto overflow-clip"),
      pagePath
    ),
    []
  )
  const grows = detect(
    bounded.replace(
      "h-full min-h-0 flex-col overflow-clip",
      "min-h-0 flex-col"
    ),
    pagePath
  )
  assert.ok(grows.some((hit) => hit.includes("fill main")))
  const scrollsPage = detect(
    bounded.replace("overflow-clip", "overflow-y-auto"),
    pagePath
  )
  assert.ok(scrollsPage.some((hit) => hit.includes("fill main")))
  const clippedPane = detect(
    bounded.replace("overflow-auto", "overflow-clip"),
    pagePath
  )
  assert.ok(clippedPane.some((hit) => hit.includes("document pane")))
  const missingPane = detect(
    bounded.replace(' data-paper-document-pane=""', ""),
    pagePath
  )
  assert.ok(missingPane.some((hit) => hit.includes("document pane")))
  assert.deepEqual(detect(bounded, "apps/web/src/features/paper/other.tsx"), [])
  assert.deepEqual(detect(read(pagePath), pagePath), [])
  const introduced = detect(
    past("82db0c773800bd130bdd73db14508071980ba8ed", pagePath),
    pagePath
  )
  assert.ok(introduced.some((hit) => hit.includes("fill main")))
  assert.ok(introduced.some((hit) => hit.includes("document pane")))
})

test("Find match count stays on one line", () => {
  const bar = read(barPath)
  const status = /role="status"[\s\S]*?className="([^"]*)"/.exec(bar)?.[1] ?? ""
  assert.match(status, /\bwhitespace-nowrap\b/)
  assert.match(status, /\btabular-nums\b/)
  assert.doesNotMatch(status, /\bmax-w-16\b/)
  assert.doesNotMatch(status, /\bbreak-words\b/)
})
