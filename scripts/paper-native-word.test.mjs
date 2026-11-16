import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-native-word.mjs"
import { detect as presentation } from "./lib/paper-presentation.mjs"

const service = "apps/api/src/paper/native-word.ts"
const qualified = `import { withRichSnapshot } from "./content-store.js"
import { compileOwnedFlowNativeDocx } from "./native-output/formatted-owned.js"
export function downloadNativeWord(userId, input) {
  return withRichSnapshot(userId, input, async snapshot => compileOwnedFlowNativeDocx({userId, document: snapshot.document}))
}`

test("only canonical snapshot qualification admits rich Word compiler activation", () => {
  assert.deepEqual(presentation(qualified, service), [])
  assert.deepEqual(detect(qualified, service), [])
  for (const mistake of [
    qualified.replace("withRichSnapshot(userId, input,", "transaction("),
    qualified.replace("snapshot.document", "input.document"),
    qualified.replace('"./content-store.js"', '"./unqualified.js"'),
    qualified.replace(
      "return withRichSnapshot",
      "compileOwnedFlowNativeDocx(input); return withRichSnapshot"
    ),
  ]) {
    assert.ok(detect(mistake, service).length)
    assert.ok(presentation(mistake, service).length)
  }
  assert.ok(presentation(qualified, "apps/api/src/paper/http.ts").length)
})

test("saved Word, photo reads and CV portrait admission retain their boundary guards", () => {
  const cases = [
    [
      "packages/domain/src/paper-doc/native-layout-flow.ts",
      ".map(withoutHeaderPortrait)",
      ".map(node => node)",
    ],
    [
      "apps/api/src/paper/content-store.ts",
      "return ownedTaskTransaction(async () =>",
      "return transaction(async () =>",
    ],
    [
      "apps/api/src/paper/native-output/formatted-owned.ts",
      "sources.add(node.photo)",
      "sources.add(node.id)",
    ],
    ["apps/api/src/paper/store.ts", 'query.for("share")', "query"],
  ]
  for (const [path, before, after] of cases) {
    const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    assert.deepEqual(detect(clean, path), [], path)
    assert.notEqual(clean.replace(before, after), clean, path)
    assert.ok(detect(clean.replace(before, after), path).length, path)
  }
  assert.deepEqual(
    detect(
      readFileSync(new URL(`../${service}`, import.meta.url), "utf8"),
      service
    ),
    []
  )
})

test("cross-origin Word downloads retain readable exact snapshot metadata", () => {
  const path = "apps/api/src/app.ts"
  const clean = `cors({ allowHeaders: ["x-paper-writer", "x-paper-basis"], exposeHeaders: ["x-paper-basis", "Content-Disposition"] })`
  assert.deepEqual(detect(clean, path), [])
  for (const missing of [
    clean.replace('"x-paper-writer", ', ""),
    clean.replace('"x-paper-basis"', '"unrelated"'),
    clean.replace('exposeHeaders: ["x-paper-basis", ', "exposeHeaders: ["),
    clean.replace('"Content-Disposition"', '"unrelated"'),
  ])
    assert.ok(detect(missing, path).length)
  assert.deepEqual(
    detect(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), path),
    []
  )
})

test("Word downloads retain their URL while the browser starts saving", () => {
  const path = "apps/web/src/lib/paper-rich-word.ts"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  assert.deepEqual(detect(clean, path), [])
  const mistake = clean.replace("}, 1000)", "}, 0)")
  assert.notEqual(mistake, clean)
  assert.ok(detect(mistake, path).length)
  const aborted = clean.replace(
    "if (triggered) {",
    `if (triggered) {
    signal.addEventListener("abort", () => URL.revokeObjectURL(url))`
  )
  assert.notEqual(aborted, clean)
  assert.ok(detect(aborted, path).length)
  const cleared = clean.replace(
    "if (triggered) {",
    "if (triggered) { clearTimeout(retention)"
  )
  assert.notEqual(cleared, clean)
  assert.ok(detect(cleared, path).length)
})

test("Word response filenames and media types tolerate valid HTTP variations", () => {
  const path = "apps/web/src/lib/paper-rich-word.ts"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  assert.deepEqual(detect(clean, path), [])
  for (const mistake of [
    clean.replace(
      "try {\n      value = decodeURIComponent(encoded)\n    } catch {\n      value = quoted\n    }",
      "value = decodeURIComponent(encoded)"
    ),
    clean.replace(".toLowerCase()", ""),
  ]) {
    assert.notEqual(mistake, clean)
    assert.ok(detect(mistake, path).length)
  }
})

test("Word menu progress, failure copy and disabled descriptions stay connected", () => {
  const path = "apps/web/src/features/paper/rich-document-menu.tsx"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  assert.deepEqual(detect(clean, path), [])
  for (const [before, after] of [
    ["error instanceof SavedRichWordChanged", "true"],
    ["toast.loading(", "toast.message("],
    ["toast.success(", "toast.message("],
    ["aria-describedby=", "data-description="],
    ['status === "refused"', "false"],
    ['status === "stuck"', "false"],
  ]) {
    assert.notEqual(clean.replace(before, after), clean)
    assert.ok(detect(clean.replace(before, after), path).length)
  }
})
