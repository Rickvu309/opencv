import assert from "node:assert/strict"
import { test } from "node:test"

import { expiredMessage, expiredPending } from "./lib/pending-fixes.mjs"
import {
  detect,
  isSource,
  readPending,
  staleEntries,
} from "./lib/comment-signals.mjs"
import { listFiles, readFromDisk } from "./no-comments.mjs"

const pending = [
  {
    file: "apps/web/src/features/x/a.tsx",
    marker: "rejected-ok:",
    issue: "#916",
    expires: "2999-01-01",
  },
]

const MISTAKE_COMMENT = "const a = 1\n// rejected-ok: nobody checks this\n"
const MISTAKE_JSX = "const a = <b>{/* Documented exception: raw input */}</b>\n"
const MISTAKE_READER =
  'const MARKER = "rejected-ok:"\nexport const has = (t) => t.includes(MARKER)\n'
const MISTAKE_COMMENT_API =
  "export const all = (sf, text) => ts.getLeadingCommentRanges(text, 0)\n"
const CLEAN =
  'export const handled = ignoreRejection(run(), "stopAfterAbortIsHarmless")\n'

test("no comment in the repo is read as permission, and no guard reads one", () => {
  const found = listFiles()
    .filter(isSource)
    .flatMap((file) => detect(readFromDisk(file), file))
  assert.deepEqual(found, [])
})

test("a comment that carries a hatch marker fires", () => {
  assert.equal(detect(MISTAKE_COMMENT, "apps/web/src/a.ts", []).length, 1)
  assert.equal(detect(MISTAKE_JSX, "apps/web/src/a.tsx", []).length, 1)
})

test("a guard or test that reads a hatch marker fires", () => {
  assert.equal(detect(MISTAKE_READER, "scripts/x.test.mjs", []).length, 1)
  assert.equal(
    detect(MISTAKE_READER, "apps/web/src/test/scan.ts", []).length,
    1
  )
})

test("a test that reads comments through the typescript api fires, and importing the shared finders does not", () => {
  assert.equal(detect(MISTAKE_COMMENT_API, "scripts/x.test.mjs", []).length, 1)
  assert.deepEqual(
    detect(MISTAKE_COMMENT_API, "scripts/no-comments.mjs", []),
    []
  )
  assert.equal(
    detect(MISTAKE_COMMENT_API, "scripts/lib/comment-spans.mjs", []).length,
    1
  )
  const imported = `import { findSourceComments, findCssComments } from "../no-comments.mjs"
export const spans = (file, text) => findSourceComments(file, text)
export const cssSpans = (text) => findCssComments(text)
`
  assert.deepEqual(detect(imported, "scripts/lib/comment-spans.mjs", []), [])
})

test("code with no marker in a comment and no reader stays quiet", () => {
  assert.deepEqual(detect(CLEAN, "apps/web/src/features/x/a.tsx", []), [])
  assert.deepEqual(detect(CLEAN, "scripts/x.test.mjs", []), [])
})

test("a marker word inside a string in application code is not a comment", () => {
  const text = 'export const label = "rejected-ok: shown to the user"\n'
  assert.deepEqual(detect(text, "apps/web/src/features/x/a.tsx", []), [])
})

test("a pending entry lets its own file keep the comment, and lets guards read the marker while it lasts", () => {
  assert.deepEqual(
    detect(MISTAKE_COMMENT, "apps/web/src/features/x/a.tsx", pending),
    []
  )
  assert.equal(
    detect(MISTAKE_COMMENT, "apps/web/src/features/x/b.tsx", pending).length,
    1
  )
  assert.deepEqual(
    detect(MISTAKE_READER, "apps/web/src/test/scan.ts", pending),
    []
  )
  assert.equal(
    detect(MISTAKE_READER, "apps/web/src/test/scan.ts", []).length,
    1
  )
})

test("a pending entry whose file no longer carries the marker is stale", () => {
  const files = [{ name: "apps/web/src/features/x/a.tsx", text: CLEAN }]
  assert.equal(staleEntries(files, pending).length, 1)
  const carrying = [
    { name: "apps/web/src/features/x/a.tsx", text: MISTAKE_COMMENT },
  ]
  assert.equal(staleEntries(carrying, pending).length, 0)
})

test("every pending hatch still has its marker and has not expired", () => {
  const entries = readPending()
  const files = listFiles()
    .filter((file) => entries.some((entry) => entry.file === file))
    .map((file) => ({ name: file, text: readFromDisk(file) }))
  assert.deepEqual(staleEntries(files, entries), [])
  assert.equal(expiredMessage(expiredPending(entries)), "")
})

test("a hit after a multi-line comment reports its own line", () => {
  const text = '/*\none\ntwo\n*/\nconst a = 1\nconst MARKER = "rejected-ok:"\n'
  assert.deepEqual(detect(text, "scripts/x.mjs", []), [
    'scripts/x.mjs:6 reads "rejected-ok:" from a comment. A guard may only read code. Replace the hatch with a named function or a typed list.',
  ])
})

test("an identical string before a comment does not shift the blanked comment", () => {
  const text = 'const a = "/* x */"\n/* x */\nconst MARKER = "guard-ok"\n'
  assert.match(detect(text, "scripts/x.mjs", [])[0], /^scripts\/x\.mjs:3 /)
})

test("a test title that says documented exception in lower case stays quiet", () => {
  const text = 'it("keeps a documented exception out", () => {})\n'
  assert.deepEqual(detect(text, "apps/web/src/foo.test.ts", []), [])
})

test("the capitalised Documented exception marker still fires in a guard and in a comment", () => {
  const reader = 'export const MARKER = "Documented exception"\n'
  assert.equal(detect(reader, "scripts/x.mjs", []).length, 1)
  const comment = "const a = 1\n// Documented exception: raw input\n"
  assert.equal(detect(comment, "apps/web/src/a.ts", []).length, 1)
})
