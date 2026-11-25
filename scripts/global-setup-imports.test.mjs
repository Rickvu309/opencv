import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detect, runtimeImports } from "./lib/global-setup-imports.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const ENTRY = "apps/api/src/test/global-setup.ts"

function inMemory(files) {
  return (file) => (file in files ? files[file] : null)
}

const SETUP = `import type { AppDatabase } from "../db/context.js"
import { installWriteLog } from "./write-log.js"
`
const WRITE_LOG = `import { ownedTableNames } from "../registry/owned.js"
`
const OWNED_WITH_WRITER = `import { RICH_NATIVE_WRITER, type QueryName } from "@workspace/domain"
import { getTableConfig } from "drizzle-orm/pg-core"
`
const OWNED_TYPES_ONLY = `import type { QueryName } from "@workspace/domain"
import { type NativeWriter } from "@workspace/domain"
import { getTableConfig } from "drizzle-orm/pg-core"
`

test("a workspace value two imports below the global setup fires", () => {
  const hits = detect(
    "apps/api/src/test/global-setup.ts",
    inMemory({
      "apps/api/src/test/global-setup.ts": SETUP,
      "apps/api/src/test/write-log.ts": WRITE_LOG,
      "apps/api/src/registry/owned.ts": OWNED_WITH_WRITER,
    })
  )
  assert.equal(hits.length, 1)
  assert.match(
    hits[0],
    /apps\/api\/src\/registry\/owned\.ts loads @workspace\/domain/
  )
})

test("type-only workspace imports stay quiet", () => {
  assert.deepEqual(
    detect(
      "apps/api/src/test/global-setup.ts",
      inMemory({
        "apps/api/src/test/global-setup.ts": SETUP,
        "apps/api/src/test/write-log.ts": WRITE_LOG,
        "apps/api/src/registry/owned.ts": OWNED_TYPES_ONLY,
      })
    ),
    []
  )
})

test("side-effect imports and re-exports count as runtime imports", () => {
  assert.deepEqual(
    runtimeImports(`import "@workspace/a"
export { b } from "@workspace/b"
export type { C } from "@workspace/c"
import * as d from "./d.js"
`),
    ["@workspace/a", "@workspace/b", "./d.js"]
  )
})

test("the API test global setup loads no workspace package at runtime", () => {
  assert.ok(existsSync(path.join(root, ENTRY)))
  const read = (file) => {
    const full = path.join(root, file)
    return existsSync(full) ? readFileSync(full, "utf8") : null
  }
  assert.deepEqual(detect(ENTRY, read), [])
})
