import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  PARSE_WORKER_SOURCE,
  detectRequestThreadParser as detect,
} from "./lib/parser-off-request-thread.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const INTRODUCED = "dbcc5d0b6b8a268f8788de55808c89e319590dbb"
const PARSE = "apps/api/src/paper/import/import-parse.ts"

const mistake = `
async function openPdfDocument(bytes: Buffer) {
  const unpdf = await import("unpdf")
  return unpdf.getDocumentProxy(new Uint8Array(bytes))
}
import mammoth from "mammoth"
`

const clean = `
import { readImportText } from "./import-text-pool.js"
import { pathAtRevision } from "./lib/path-at-revision.mjs"
async function defaultPdfText(bytes: Buffer) {
  return readImportText({ kind: "pdf", bytes, whole: true, deadlineMs: 10_000 })
}
`

test("a PDF or Word parser imported on the API request thread fires, and the parse worker stays quiet", () => {
  assert.equal(detect(mistake, PARSE).length, 2)
  assert.deepEqual(detect(clean, PARSE), [])
  assert.deepEqual(detect(mistake, PARSE_WORKER_SOURCE), [])
  assert.deepEqual(
    detect(mistake, "apps/api/src/paper/import/import-word.test.ts"),
    []
  )
  assert.deepEqual(detect(mistake, "apps/web/src/lib/paper-api.ts"), [])
})

test("the import parser at the commit that first read PDFs on the request thread fires", () => {
  const past = execFileSync(
    "git",
    ["show", `${INTRODUCED}:${pathAtRevision(INTRODUCED, PARSE)}`],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
  assert.ok(detect(past, PARSE).length > 0)
})

test("no API source imports a PDF or Word parser outside the parse worker", () => {
  const files = execFileSync("git", ["ls-files", "apps/api/src"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
  const hits = files.flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8"), file).map(
      (hit) => `${file}:${hit.line} ${hit.text}`
    )
  )
  assert.deepEqual(hits, [])
})
