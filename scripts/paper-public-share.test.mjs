import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  detectSharedCachePolicy,
  detectSharedOwnerProjection,
} from "./lib/paper-public-share.mjs"

const publicProjection = `
export function toSharedPaper(row) {
  const paper = readStoredPaper(row)
  return paperSharedViewSchema.parse({
    id: row.id,
    name: row.name,
    kind: row.kind,
    templateId: row.templateId,
    paper: { ...paper, clashes: [] },
  })
}
`

test("shared projection refuses full and partially stripped owner views", () => {
  for (const body of [
    "return toPaper(row.doc)",
    "const { isFavorite, ...shared } = toPaper(row.doc); return shared",
  ]) {
    assert.equal(
      detectSharedOwnerProjection(`export function readShared() { ${body} }`)
        .length,
      1
    )
  }
  assert.deepEqual(detectSharedOwnerProjection(publicProjection), [])
  assert.deepEqual(
    detectSharedOwnerProjection(`export function readShared() {
      return toSharedPaper(row.doc, writer)
    }`),
    []
  )
})

test("public projection refuses owner spreads and unresolved alternatives", () => {
  assert.equal(
    detectSharedOwnerProjection(
      publicProjection.replace("id: row.id,", "...toPaper(row),")
    ).length,
    1
  )
  assert.equal(
    detectSharedOwnerProjection(
      publicProjection.replace("{ ...paper, clashes: [] }", "paper")
    ).length,
    1
  )
  assert.equal(
    detectSharedOwnerProjection(
      publicProjection.replace("clashes: []", "clashes: paper.clashes")
    ).length,
    1
  )
})

const uncachedRoutes = `
routes.use("/shared/*", async (c, next) => {
  c.header("cache-control", "no-store")
  await next()
})
routes.get("/shared/:token", async (c) => c.json(await readShared(token)))
routes.get("/shared/:token/photo", async (c) =>
  photoBytes(await readSharedPhoto(token), "no-store"))
`

test("revocable shared responses require no-store for JSON, photos and errors", () => {
  assert.deepEqual(detectSharedCachePolicy(uncachedRoutes), [])
  assert.equal(
    detectSharedCachePolicy(
      uncachedRoutes.replace('c.header("cache-control", "no-store")', "")
    ).length,
    1
  )
  assert.equal(
    detectSharedCachePolicy(
      uncachedRoutes.replace(
        'photoBytes(await readSharedPhoto(token), "no-store")',
        'photoBytes(await readSharedPhoto(token), "public, max-age=60")'
      )
    ).length,
    1
  )
})

test("accepted public projection and routes retain both boundaries", () => {
  for (const file of ["store.ts"]) {
    assert.deepEqual(
      detectSharedOwnerProjection(
        readFileSync(
          new URL(`../apps/api/src/paper/${file}`, import.meta.url),
          "utf8"
        )
      ),
      []
    )
  }
  assert.deepEqual(
    detectSharedCachePolicy(
      readFileSync(
        new URL("../apps/api/src/paper/http.ts", import.meta.url),
        "utf8"
      )
    ),
    []
  )
})
