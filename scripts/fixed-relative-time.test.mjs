import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/fixed-relative-time.mjs"

const ILLUSTRATION = /\/figures\/|-art\.tsx$/

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MISTAKE = `export function Status({ status }) {
  return (
    <p role="status">
      {status === "Saved" ? (
        <>
          <span>Edited just now</span>
          <span className="sr-only"> Saved</span>
        </>
      ) : (
        status
      )}
    </p>
  )
}
`

const CLEAN = `export function Status({ status, edited }) {
  return (
    <p role="status">
      {status === "Saved" && edited ? (
        <>
          <span>{edited}</span>
          <span className="sr-only"> Saved</span>
        </>
      ) : (
        status
      )}
    </p>
  )
}
`

test("MISTAKE: a header that always says Edited just now fires", () => {
  const hits = detect(MISTAKE, "document-chrome.tsx")
  assert.equal(hits.length, 1)
  assert.match(hits[0], /^document-chrome\.tsx:6 "just now": /)
})

test("the same header showing a computed time stays quiet", () => {
  assert.deepEqual(detect(CLEAN, "document-chrome.tsx"), [])
})

test("fixed ages in markup fire and ages computed in code stay quiet", () => {
  assert.equal(detect(`<td>3 days ago</td>`, "a.tsx").length, 1)
  assert.equal(detect(`<b>Saved 12 minutes ago</b>`, "a.tsx").length, 1)
  assert.deepEqual(
    detect(
      `const label = delta < 60_000 ? "just now" : \`\${n}m ago\`
<span>{label}</span>
<p>Days ago you wrote {n} letters</p>`,
      "quiet.tsx"
    ),
    []
  )
})

test("illustrations of the product may show a fixed age", () => {
  assert.ok(
    ILLUSTRATION.test(
      "apps/web/src/features/landing/figures/oc/paper-editor.tsx"
    )
  )
  assert.ok(
    ILLUSTRATION.test("apps/web/src/features/coming-soon/pitch-hero-art.tsx")
  )
  assert.ok(
    !ILLUSTRATION.test("apps/web/src/features/paper-page/document-chrome.tsx")
  )
})

test("no tracked app or kit component writes a relative time as fixed markup", () => {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps",
      "packages",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => file.endsWith(".tsx"))
    .filter((file) => !/\.test\.tsx$|\/test\/|\.fixtures\.tsx$/.test(file))
    .filter((file) => !ILLUSTRATION.test(file))
  const hits = files.flatMap((file) => {
    let source
    try {
      source = readFileSync(path.join(root, file), "utf8")
    } catch {
      return []
    }
    return detect(source, file)
  })
  assert.deepEqual(hits, [])
})
