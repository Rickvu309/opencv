import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { pagesInComponents } from "./lib/page-in-components.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MOVED_OUT = "aa63a3ec7"
const OLD_PAGE = "apps/web/src/components/not-found-page.tsx"

const MISTAKE = `export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center">
      <Button type="button">Back to start</Button>
    </main>
  )
}`

const CLEAN = `export function EmptyState() {
  return <div className="flex h-full flex-col items-center">Nothing yet</div>
}`

const sharedComponents = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src/components",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
    .filter((file) => existsSync(path.join(root, file)))

test("MISTAKE: a shared component that fills the screen and draws the main landmark is a page", () => {
  assert.equal(pagesInComponents(MISTAKE, OLD_PAGE).length, 2)
})

test("a part of a page in the shared components stays quiet, and so does a page kept in a feature", () => {
  assert.deepEqual(
    pagesInComponents(CLEAN, "apps/web/src/components/empty-state.tsx"),
    []
  )
  assert.deepEqual(
    pagesInComponents(
      MISTAKE,
      "apps/web/src/features/app-shell/not-found-page.tsx"
    ),
    []
  )
})

test("the page-not-found screen fires at the commit before it left the shared components", () => {
  const past = execFileSync("git", ["show", `${MOVED_OUT}^:${OLD_PAGE}`], {
    cwd: root,
    encoding: "utf8",
  })
  assert.ok(pagesInComponents(past, OLD_PAGE).length > 0)
})

test("no file in the shared components folder is a page", () => {
  const found = sharedComponents().flatMap((file) =>
    pagesInComponents(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.deepEqual(
    found.map((problem) => problem.message),
    []
  )
})
