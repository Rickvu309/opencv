import { randomUUID } from "node:crypto"

import { catalog } from "@workspace/domain/kernel"
import {
  paperPackageMetadataSchema,
  paperWordReadSchema,
  paperPackageStageSchema,
} from "@workspace/domain/paper-doc"
import { expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { z } from "zod"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../../test/harness.js"
import { withDatabase } from "../../db/context.js"
import { user } from "../../db/schema.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import {
  WORD_PACKAGE_MEDIA_TYPE,
  stageWordPackage,
  publishWordPackage,
} from "./package-store.js"
import { paperReadRequest } from "../../test/paper-live-pages.js"

it("authenticates staging, reads pinned snapshots, and exports exact DOCX bytes over HTTP", async () => {
  const { db, client } = await createMigratedTestDb()
  try {
    const app = createTestApp(db)
    expect((await app.request("/api/paper/packages/")).status).toBe(401)
    const signed = await signUp(app, {
      name: "Package owner",
      email: `${randomUUID()}@test.invalid`,
    })
    const headers = new Headers({
      ...authHeaders(signed.cookie),
      "idempotency-key": randomUUID(),
    })
    headers.set("content-type", WORD_PACKAGE_MEDIA_TYPE)
    const bytes = fixturePackage(paragraph("HTTP original words"))
    const stagedResponse = await app.request(
      "/api/paper/packages/stage?name=Letter&kind=letter",
      { method: "POST", headers, body: new Uint8Array(bytes) }
    )
    expect(stagedResponse.status, await stagedResponse.clone().text()).toBe(201)
    const staged = z
      .object({ data: paperPackageStageSchema })
      .parse(await stagedResponse.json()).data
    expect(
      (
        await app.request(
          "/api/reads/paper.read",
          paperReadRequest(
            { view: "lines", docId: staged.docId },
            signed.cookie
          )
        )
      ).status
    ).toBe(404)
    const commandHeaders = {
      ...authHeaders(signed.cookie),
      "content-type": "application/json",
    }
    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.email, signed.user.email))
    if (!owner) throw new Error("Missing package owner")
    const publish = () =>
      withDatabase(db, () => publishWordPackage(owner.id, staged.stageId))
    const publishedData = paperPackageMetadataSchema.parse(await publish())
    expect(publishedData).toMatchObject({
      generation: "package",
      docId: staged.docId,
      revision: staged.revision,
    })
    expect(paperPackageMetadataSchema.parse(await publish())).toEqual(
      publishedData
    )
    const library = await app.request("/api/reads/paper.read", {
      method: "POST",
      headers: commandHeaders,
      body: JSON.stringify({ view: "library" }),
    })
    expect(library.status, await library.clone().text()).toBe(200)
    expect(
      z
        .object({ data: catalog["paper.read"].publicResult })
        .parse(await library.json()).data
    ).toMatchObject({ items: [publishedData], next: null })
    const exported = await app.request("/api/reads/paper.export", {
      method: "POST",
      headers: commandHeaders,
      body: JSON.stringify({ docId: staged.docId, at: staged.revision }),
    })
    expect(exported.status, await exported.clone().text()).toBe(200)
    expect(
      z
        .object({ data: catalog["paper.export"].publicResult })
        .parse(await exported.json()).data
    ).toMatchObject({
      revision: staged.revision,
      downloadPath: `/api/paper/packages/${staged.docId}/export?at=${staged.revision}`,
    })
    const read = await app.request(
      "/api/reads/paper.read",
      paperReadRequest(
        { view: "lines", docId: staged.docId, at: staged.revision },
        signed.cookie
      )
    )
    expect(read.status).toBe(200)
    expect(read.headers.get("cache-control")).toBe("private, no-store")
    const page = z
      .object({ data: paperWordReadSchema })
      .parse(await read.json()).data
    expect(page.paragraphs[0]?.text).toBe("HTTP original words")
    const downloaded = await app.request(
      `/api/paper/packages/${staged.docId}/export?at=${staged.revision}`,
      { headers }
    )
    expect(downloaded.status).toBe(200)
    expect(downloaded.headers.get("content-type")).toBe(WORD_PACKAGE_MEDIA_TYPE)
    expect(downloaded.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''Letter.docx"
    )
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes)
    expect(
      (
        await app.request(`/api/paper/packages/${staged.docId}/export`, {
          headers,
        })
      ).status
    ).toBe(400)
    expect(
      (
        await app.request(`/api/paper/packages/${staged.docId}/publish`, {
          method: "POST",
          headers,
        })
      ).status
    ).toBe(404)
    const oversizeHeaders = new Headers(headers)
    oversizeHeaders.set("content-length", String(8 * 1024 * 1024 + 1))
    const oversize = await app.request(
      "/api/paper/packages/stage?name=big.docx&kind=cv",
      {
        method: "POST",
        headers: oversizeHeaders,
        body: new Uint8Array(bytes),
      }
    )
    expect(oversize.status).toBe(400)
  } finally {
    await client.close()
  }
})

it("traverses 51 published Word documents without losing or repeating a head", async () => {
  const { db, client } = await createMigratedTestDb()
  try {
    const app = createTestApp(db)
    const signed = await signUp(app, {
      name: "Library owner",
      email: `${randomUUID()}@test.invalid`,
    })
    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.email, signed.user.email))
    if (!owner) throw new Error("Missing library owner")
    const bytes = fixturePackage(paragraph("Saved original words"))
    const published: string[] = []
    await withDatabase(db, async () => {
      for (let index = 0; index < 51; index++) {
        const stage = await stageWordPackage(
          owner.id,
          {
            requestId: randomUUID(),
            name: `Letter ${index}.docx`,
            kind: "letter",
          },
          bytes
        )
        published.push(
          (await publishWordPackage(owner.id, stage.stageId)).docId
        )
      }
    })
    const read = async (after?: string) => {
      const response = await app.request("/api/reads/paper.read", {
        method: "POST",
        headers: authHeaders(signed.cookie),
        body: JSON.stringify({ view: "library", ...(after ? { after } : {}) }),
      })
      expect(response.status, await response.clone().text()).toBe(200)
      const result = z
        .object({ data: catalog["paper.read"].publicResult })
        .parse(await response.json()).data
      if (!("items" in result)) throw new Error("Expected library page")
      return result
    }
    const first = await read()
    expect(first.items).toHaveLength(50)
    expect(first.next).toBe(first.items.at(-1)?.docId)
    if (!first.next) throw new Error("Missing second-page cursor")
    const second = await read(first.next)
    expect(second.items).toHaveLength(1)
    expect(second.next).toBeNull()
    expect(
      [...first.items, ...second.items].map((item) => item.docId).sort()
    ).toEqual(published.sort())
  } finally {
    await client.close()
  }
})
