import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detectUnownedPageRequest } from "./lib/writing-page-fixtures.mjs"

test("page request fixtures cannot strand a document's serial save queue", () => {
  assert.ok(
    detectUnownedPageRequest("return new Promise<Response>(() => undefined)")
      .length > 0
  )
  assert.ok(detectUnownedPageRequest("return new Promise(() => {})").length > 0)
  assert.deepEqual(
    detectUnownedPageRequest(
      "const response = Promise.withResolvers<Response>(); return response.promise"
    ),
    []
  )
  assert.deepEqual(
    detectUnownedPageRequest(
      "return new Promise<Response>((resolve) => { finish = resolve })"
    ),
    []
  )
  assert.deepEqual(
    detectUnownedPageRequest("throw new Error(`Unexpected request: ${path}`)"),
    []
  )
  assert.deepEqual(
    detectUnownedPageRequest(
      readFileSync(
        new URL(
          "../apps/web/src/features/paper/writing-page.test.tsx",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
