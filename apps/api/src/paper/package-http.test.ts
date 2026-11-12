import { randomUUID } from "node:crypto"

import {
  catalog,
  paperPackageMetadataSchema,
  paperWordReadSchema,
  paperPackageStageSchema,
} from "@workspace/domain"
import { expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import { z } from "zod"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { withDatabase } from "../db/context.js"
import { files, paperDocs, user } from "../db/schema.js"
import { registry } from "../registry/registry.js"
import { textPdf } from "./import-fixtures.test.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import {
  WORD_PACKAGE_MEDIA_TYPE,
  stageWordPackage,
  publishWordPackage,
} from "./package-store.js"

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
      "/api/paper/packages/stage?name=Letter.docx&kind=letter",
      { method: "POST", headers, body: new Uint8Array(bytes) }
    )
    expect(stagedResponse.status, await stagedResponse.clone().text()).toBe(201)
    const staged = z
      .object({ data: paperPackageStageSchema })
      .parse(await stagedResponse.json()).data
    expect(
      (
        await app.request(`/api/paper/packages/${staged.docId}/read`, {
          headers,
        })
      ).status
    ).toBe(404)
    const commandHeaders = {
      ...authHeaders(signed.cookie),
      "content-type": "application/json",
    }
    const commandInput = { generation: "package", stageId: staged.stageId }
    const publishKey = randomUUID()
    const publish = () =>
      app.request("/api/commands/paper.import", {
        method: "POST",
        headers: commandHeaders,
        body: JSON.stringify({
          input: commandInput,
          idempotencyKey: publishKey,
        }),
      })
    const published = await publish()
    expect(published.status, await published.clone().text()).toBe(200)
    const publishedData = z
      .object({ data: catalog["paper.import"].publicResult })
      .parse(await published.json()).data
    expect(publishedData).toMatchObject({
      generation: "package",
      docId: staged.docId,
      revision: staged.revision,
    })
    expect(
      z
        .object({ data: catalog["paper.import"].publicResult })
        .parse(await (await publish()).json()).data
    ).toEqual(publishedData)
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
      `/api/paper/packages/${staged.docId}/read?at=${staged.revision}`,
      { headers }
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

it("moves Word uploads into the immutable library without a legacy document or flattened file", async () => {
  const { db, client } = await createMigratedTestDb()
  try {
    const app = createTestApp(db)
    const signed = await signUp(app, {
      name: "Upload owner",
      email: `${randomUUID()}@test.invalid`,
    })
    const headers = new Headers({
      ...authHeaders(signed.cookie),
      "idempotency-key": randomUUID(),
    })
    headers.delete("content-type")
    const bytes = fixturePackage(paragraph("Original Word body"))
    const upload = (kind = "letter") => {
      const body = new FormData()
      body.set(
        "file",
        new File([new Uint8Array(bytes)], "My Letter.docx", {
          type: WORD_PACKAGE_MEDIA_TYPE,
        })
      )
      return app.request(`/api/paper/import?kind=${kind}`, {
        method: "POST",
        headers,
        body,
      })
    }
    const invalid = await upload("invalid")
    expect(invalid.status, await invalid.clone().text()).toBe(400)
    const empty = await app.request("/api/reads/paper.read", {
      method: "POST",
      headers: authHeaders(signed.cookie),
      body: JSON.stringify({ view: "library" }),
    })
    expect(
      z
        .object({ data: catalog["paper.read"].publicResult })
        .parse(await empty.json()).data
    ).toEqual({ items: [], next: null })
    const response = await upload()
    expect(response.status, await response.clone().text()).toBe(200)
    const receipt = z
      .object({ data: paperPackageMetadataSchema })
      .parse(await response.json()).data
    expect(receipt).toMatchObject({
      generation: "package",
      name: "My Letter.docx",
      kind: "letter",
    })
    expect(
      z
        .object({ data: paperPackageMetadataSchema })
        .parse(await (await upload()).json()).data
    ).toEqual(receipt)
    for (const path of ["/api/paper", "/api/paper/files"]) {
      const legacy = await app.request(path, { headers })
      expect(legacy.status, await legacy.clone().text()).toBe(200)
      expect(
        z.object({ data: z.array(z.unknown()) }).parse(await legacy.json()).data
      ).toEqual([])
    }
    const download = await app.request(
      `/api/paper/packages/${receipt.docId}/export?at=${receipt.revision}`,
      { headers }
    )
    expect(download.status).toBe(200)
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes)
    const other = await signUp(app, {
      name: "Other owner",
      email: `${randomUUID()}@test.invalid`,
    })
    const denied = await app.request(
      `/api/paper/packages/${receipt.docId}/read?at=${receipt.revision}`,
      { headers: authHeaders(other.cookie) }
    )
    expect(denied.status).toBe(404)
    const otherLibrary = await app.request("/api/reads/paper.read", {
      method: "POST",
      headers: {
        ...authHeaders(other.cookie),
        "content-type": "application/json",
      },
      body: JSON.stringify({ view: "library" }),
    })
    expect(
      z
        .object({ data: catalog["paper.read"].publicResult })
        .parse(await otherLibrary.json()).data
    ).toEqual({ items: [], next: null })
  } finally {
    await client.close()
  }
})

it("keeps the committed import and its original upload when the response read fails", async () => {
  const { db, client } = await createMigratedTestDb()
  try {
    const app = createTestApp(db)
    const signed = await signUp(app, {
      name: "Upload owner",
      email: `${randomUUID()}@test.invalid`,
    })
    const headers = new Headers(authHeaders(signed.cookie))
    headers.delete("content-type")
    const form = new FormData()
    form.set(
      "file",
      new File(
        [new Uint8Array(textPdf("Original uploaded words"))],
        "Original.pdf",
        { type: "application/pdf" }
      )
    )
    const read = vi
      .spyOn(registry, "read")
      .mockRejectedValueOnce(new Error("Read failed after commit"))
    try {
      const response = await app.request("/api/paper/import", {
        method: "POST",
        headers,
        body: form,
      })
      expect(response.status).toBe(500)
      expect(read).toHaveBeenCalledWith(
        "paper.get",
        expect.any(Object),
        expect.any(Object)
      )
      const [document] = await db.select().from(paperDocs)
      expect(document).toBeDefined()
      expect(document?.sourceFileId).not.toBeNull()
      const saved = await db
        .select()
        .from(files)
        .where(
          eq(
            files.id,
            document?.sourceFileId ?? "00000000-0000-4000-8000-000000000000"
          )
        )
      expect(saved).toHaveLength(1)
      expect(saved[0]?.name).toBe("Original.pdf")
    } finally {
      read.mockRestore()
    }
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
