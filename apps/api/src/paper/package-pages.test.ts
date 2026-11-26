import { randomUUID } from "node:crypto"

import {
  PAPER_PACKAGE_LIMITS,
  PAPER_PACKAGE_PROJECTOR,
  type PaperPackageMetadata,
  type PaperPackageProjection,
} from "@workspace/domain/paper-doc"
import { expect, it } from "vitest"

import { PaperPackage } from "./word-package/package-engine.js"
import { fixturePackage, paragraph } from "./word-package/package-fixtures.js"
import { packageDigest, packagePage } from "./package-pages.js"

it("hashes JSON values independently of PostgreSQL JSONB property order", () => {
  expect(packageDigest({ b: [{ y: 1, x: 2 }], a: 3 })).toBe(
    packageDigest({ a: 3, b: [{ x: 2, y: 1 }] })
  )
  expect(packageDigest({ a: 3 })).not.toBe(packageDigest({ a: "3" }))
})

it("pages all locked text at scalar boundaries and budgets the escaped success envelope", async () => {
  const docId = randomUUID(),
    revision = randomUUID(),
    incarnation = randomUUID()
  const opened = await PaperPackage.open(fixturePackage(paragraph("context")), {
    docId,
    revision,
    incarnation,
  })
  const region = opened.read().regions[0]
  if (!region) throw new Error("Missing region")
  const text = `${'\u0001"\\😀'.repeat(10000)}last`
  const projection: PaperPackageProjection = {
    ...opened.read(),
    regions: [
      {
        kind: "locked",
        text,
        location: region.location,
        reason: {
          code: "LOCKED",
          message: "This text cannot be changed safely.",
        },
        complete: true,
      },
    ],
  }
  const metadata: PaperPackageMetadata = {
    generation: "package",
    docId,
    revision,
    name: '"'.repeat(200),
    kind: "cv",
    packageHash: "a".repeat(64),
    byteSize: 100,
  }
  const base = { metadata, projection, owner: "owner", key: "secret" }
  let page = packagePage(base)
  let restored = ""
  let pages = 0
  do {
    expect(
      Buffer.byteLength(JSON.stringify({ ok: true, data: page }))
    ).toBeLessThanOrEqual(PAPER_PACKAGE_LIMITS.pageBytes)
    expect(page.projector).toBe(PAPER_PACKAGE_PROJECTOR)
    expect(page.regions.length).toBeLessThanOrEqual(
      PAPER_PACKAGE_LIMITS.pageRegions
    )
    for (const item of page.regions) {
      expect(item.kind).toBe("locked")
      expect(Buffer.from(item.text).toString("utf8")).toBe(item.text)
      expect(Buffer.byteLength(item.text)).toBeLessThanOrEqual(
        PAPER_PACKAGE_LIMITS.textBytes
      )
      restored += item.text
      if (item.kind === "locked")
        expect(item.complete).toBe(restored.length === text.length)
    }
    pages++
    if (!page.nextCursor) break
    page = packagePage({ ...base, cursor: page.nextCursor })
  } while (pages < 100)
  expect(page.nextCursor).toBeNull()
  expect(restored).toBe(text)
  expect(pages).toBeGreaterThan(1)
})

it("never truncates an editable region or its context and locks oversized formatting honestly", async () => {
  const docId = randomUUID(),
    revision = randomUUID(),
    incarnation = randomUUID()
  const opened = await PaperPackage.open(
    fixturePackage(paragraph('exact "quoted" text')),
    { docId, revision, incarnation }
  )
  const projection = opened.read()
  const original = projection.regions[0]
  if (!original || original.kind !== "editable")
    throw new Error("Missing editable region")
  const metadata: PaperPackageMetadata = {
    generation: "package",
    docId,
    revision,
    name: "name",
    kind: "cv",
    packageHash: "a".repeat(64),
    byteSize: 100,
  }
  const base = { metadata, projection, owner: "owner", key: "secret" }
  expect(packagePage(base).regions[0]).toEqual(original)
  original.formatting = {
    kind: "known",
    scope: "direct-run-properties",
    properties: [
      { name: "large", values: [{ name: "x", value: "x".repeat(70000) }] },
    ],
  }
  const page = packagePage(base)
  expect(page.regions[0]).toMatchObject({
    kind: "locked",
    text: original.text,
    complete: true,
    reason: { code: "PUBLIC_REGION_TOO_LARGE" },
  })
  expect(original.kind).toBe("editable")
  expect(page.nextCursor).toBeNull()
})
