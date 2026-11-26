import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-header-fit.mjs"
import { pathAtRevision } from "./lib/path-at-revision.mjs"

const cssPath = "apps/web/src/features/paper/rich-editor/rich-page-header.css"
const pagePath = "apps/web/src/features/paper/rich-editor/rich-page.tsx"
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const git = (...args) => execFileSync("git", args, { encoding: "utf8" })
const pathAt = (rev, current) => {
  const path = pathAtRevision(rev, current)
  const dir = path.slice(0, path.lastIndexOf("/") + 1)
  const stem = path.slice(dir.length).replace(/\.css$/, ".")
  const names = git("ls-tree", "--name-only", rev, dir).split("\n")
  return (
    names.find((name) => name === path) ??
    names.find(
      (name) => name.startsWith(`${dir}${stem}`) && name.endsWith(".css")
    ) ??
    path
  )
}
const past = (rev, path) => git("show", `${rev}:${pathAt(rev, path)}`)

test("Paper header detector rejects mixed title units and an unshrinkable status without a browser", () => {
  const clean = [
    [
      cssPath,
      "flex-basis: calc(3.25rem + 4ch); min-width: calc(3.25rem + 4ch);",
    ],
    [cssPath, "min-height: 52px; min-width: 4ch;"],
    [
      pagePath,
      '<div className="ml-auto flex min-w-0 max-w-full items-center gap-2"><span role="status">Saved</span></div><p aria-hidden="true" data-slot="paper-status-detail">Offline, retrying</p>',
    ],
  ]
  const mistakes = [
    [cssPath, "flex-basis: calc(52px + 4ch);"],
    [cssPath, "min-width: calc(4ch + 52px);"],
    [
      pagePath,
      '<div className="ml-auto flex shrink-0 items-center gap-2"><span role="status">Saved</span></div><p aria-hidden="true" data-slot="paper-status-detail">Offline, retrying</p>',
    ],
    [
      pagePath,
      '<div className="ml-auto flex items-center gap-2"><span role="status">Saved</span></div><p aria-hidden="true" data-slot="paper-status-detail">Offline, retrying</p>',
    ],
    [
      pagePath,
      '<div className="ml-auto flex min-w-0 items-center gap-2"><span role="status" className="shrink-0 truncate">Saved</span></div><p aria-hidden="true" data-slot="paper-status-detail">Offline, retrying</p>',
    ],
    [
      pagePath,
      '<div className="ml-auto flex min-w-0 items-center gap-2"><span role="status" title="Offline, retrying">Offline, retrying</span></div>',
    ],
  ]
  for (const [path, text] of clean) assert.deepEqual(detect(text, path), [])
  for (const [path, text] of mistakes) assert.ok(detect(text, path).length)
  for (const path of [cssPath, pagePath])
    assert.deepEqual(detect(read(path), path), [])
})

test("Paper header detector fires on the reviewed title mix and historic status mistakes", () => {
  assert.ok(
    detect(past("a7cdb745", cssPath), cssPath).some((hit) =>
      hit.includes("mixes fixed")
    )
  )
  for (const rev of ["b25d93f1", "31528653", "7f4a5597"]) {
    const hits = detect(past(rev, pagePath), pagePath)
    assert.ok(
      hits.some((hit) => hit.includes("cannot shrink")),
      rev
    )
    assert.ok(
      hits.some((hit) => hit.includes("no full message")),
      rev
    )
  }
})

test("Paper status detail cannot disappear at every offline typing pause", () => {
  assert.deepEqual(
    detect(
      '{statusDetail.visible ? <p aria-hidden="true" data-slot="paper-status-detail" /> : null}',
      pagePath
    ),
    []
  )
  assert.ok(
    detect(
      '{editorError || !["loading", "saving", "saved"].includes(status) ? <p aria-hidden="true" data-slot="paper-status-detail" /> : null}',
      pagePath
    ).some((hit) => hit.includes("offline typing"))
  )
  assert.ok(
    detect(past("b6bd2419", pagePath), pagePath).some((hit) =>
      hit.includes("offline typing")
    )
  )
})

test("Paper status stays in one permanently exposed live region", () => {
  const clean =
    '<span role="status">Offline, retrying</span><p aria-hidden="true" data-slot="paper-status-detail">Offline, retrying</p>'
  assert.deepEqual(detect(clean, pagePath), [])
  for (const mistake of [
    clean.replace(
      'role="status"',
      'role="status" aria-hidden={statusDetailVisible}'
    ),
    clean.replace('aria-hidden="true"', 'role="status"'),
    clean.replace('aria-hidden="true"', ""),
  ])
    assert.ok(detect(mistake, pagePath).length)
  const hits = detect(past("4958d450", pagePath), pagePath)
  assert.ok(hits.some((hit) => hit.includes("stay exposed")))
  assert.ok(hits.some((hit) => hit.includes("hidden from assistive")))
})

test("Paper detail resets on layout changes without resetting for typing", () => {
  const path = "apps/web/src/features/paper/rich-editor/rich-status-detail.ts"
  assert.deepEqual(detect(read(path), path), [])
  assert.ok(detect(past("4958d450", path), path).length)
  const clean =
    "previous.width !== layout.width; previous.font !== layout.font; visible: action.resized ? action.clipped : state.visible || action.clipped"
  assert.deepEqual(detect(clean, path), [])
  assert.ok(
    detect(clean.replace("action.resized ? action.clipped : ", ""), path).length
  )
})
