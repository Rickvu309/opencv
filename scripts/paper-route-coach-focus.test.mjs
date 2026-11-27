import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/paper-route-coach-focus.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const ROUTES = "apps/web/src/routes"
const DOC_ROUTE = `${ROUTES}/paper-doc.tsx`

const MISTAKE = `
import { PaperChrome } from "@/features/paper/editor/chrome/paper-chrome.tsx"
import { openPaperSync } from "@/lib/paper-sync.ts"
export function PaperDocPage({ docId }) {
  const paper = useOpened(() => openPaperSync(docId, ports))
  return <PaperChrome doc={paper.doc} sync={paper.sync} />
}
`

const CLEAN = `
import { PaperChrome } from "@/features/paper/editor/chrome/paper-chrome.tsx"
import { openPaperSync } from "@/lib/paper-sync.ts"
import { holdWritingCoachFocus } from "@/lib/writing-coach-focus.ts"
export function PaperDocPage({ docId }) {
  useEffect(() => holdWritingCoachFocus(docId), [docId])
  const paper = useOpened(() => openPaperSync(docId, ports))
  return <PaperChrome doc={paper.doc} sync={paper.sync} />
}
`

const LOCAL_ONLY = `
import { PaperChrome } from "@/features/paper/editor/chrome/paper-chrome.tsx"
export function Lab() {
  return <PaperChrome doc={doc} />
}
`

test("a route that opens a saved Paper in the editor without holding the Coach focus fires", () => {
  const problems = detect(MISTAKE, DOC_ROUTE)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /without holdWritingCoachFocus/)
})

test("a route that holds the Coach focus stays quiet", () => {
  assert.deepEqual(detect(CLEAN, DOC_ROUTE), [])
})

test("an editor with no saved Paper and a file outside the routes stay quiet", () => {
  assert.deepEqual(detect(LOCAL_ONLY, `${ROUTES}/paper-lab.tsx`), [])
  assert.deepEqual(
    detect(
      MISTAKE,
      "apps/web/src/features/paper/editor/chrome/paper-chrome.tsx"
    ),
    []
  )
})

test("every route that opens a saved Paper holds the Coach focus", () => {
  const problems = readdirSync(path.join(root, ROUTES))
    .filter((name) => name.endsWith(".tsx"))
    .flatMap((name) =>
      detect(
        readFileSync(path.join(root, ROUTES, name), "utf8"),
        `${ROUTES}/${name}`
      )
    )
  assert.deepEqual(problems, [])
})
