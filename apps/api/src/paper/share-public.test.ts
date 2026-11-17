import {
  NATIVE_WRITER,
  blankCv,
  fileIdSchema,
  nativePaperDocumentSchema,
  paperDocumentSchema,
  paperIdSchema,
  paperSharedViewSchema,
  paperViewSchema,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { paperDocs } from "../db/schema.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { seedColumns } from "./content-document.js"
import { png, postAvatar } from "./photo.fixtures.js"

let store: Awaited<ReturnType<typeof createMigratedTestDb>>
let app: ReturnType<typeof createTestApp>
let cookie: string

beforeAll(async () => {
  store = await createMigratedTestDb()
  app = createTestApp(store.db)
  cookie = (
    await signUp(app, {
      name: "Paper owner",
      email: "paper-public@example.com",
    })
  ).cookie
})

afterAll(async () => {
  await store.client.close()
})

const privateAlternative = "Private rejected alternative Việt 😀"
const letter = paperDocumentSchema.parse({
  version: 3,
  kind: "letter",
  blocks: [{ id: "body", type: "paragraph", content: "Dear Việt 😀 team" }],
  clashes: [],
})

async function command(name: string, input: unknown) {
  const response = await app.request(`/api/commands/${name}`, {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ input }),
  })
  expect(response.status).toBe(200)
  return response.json()
}

describe("public Paper projection", () => {
  it("keeps old document and photo links revoked when sharing again", async () => {
    const created = z.object({ data: z.object({ id: paperIdSchema }) }).parse(
      await command("paper.create", {
        kind: "cv",
        name: "Shared photo CV",
        templateId: "with-photo",
      })
    )
    const docId = created.data.id
    const uploaded = await postAvatar(app, cookie, png, "face.png", "image/png")
    expect(uploaded.status).toBe(200)
    const photo = z
      .object({ data: z.object({ id: fileIdSchema }) })
      .parse(await uploaded.json())
    await command("paper.attachPhoto", { docId, fileId: photo.data.id })
    const link = z.object({ data: z.object({ token: z.string() }) })
    const original = link.parse(await command("paper.share", { docId }))
    await command("paper.unshare", { docId })
    const renewed = link.parse(await command("paper.share", { docId }))
    expect(renewed.data.token).not.toBe(original.data.token)
    const current = await app.request(`/api/paper/shared/${renewed.data.token}`)
    expect(current.status).toBe(200)
    expect(current.headers.get("cache-control")).toBe("no-store")
    expect(
      z.object({ data: paperSharedViewSchema }).parse(await current.json()).data
        .id
    ).toBe(docId)
    const currentPhoto = await app.request(
      `/api/paper/shared/${renewed.data.token}/photo`
    )
    expect(currentPhoto.status).toBe(200)
    expect(currentPhoto.headers.get("cache-control")).toBe("no-store")
    expect(new Uint8Array(await currentPhoto.arrayBuffer())).toEqual(png)
    for (const suffix of ["", "/photo"]) {
      const revoked = await app.request(
        `/api/paper/shared/${original.data.token}${suffix}`
      )
      expect(revoked.status).toBe(404)
      expect(revoked.headers.get("cache-control")).toBe("no-store")
    }
    await command("paper.unshare", { docId })
  })

  it("admits a compatible native viewer without exposing owner edit authority", async () => {
    const created = z.object({ data: z.object({ id: paperIdSchema }) }).parse(
      await command("paper.create", {
        kind: "letter",
        name: "Native shared Letter",
        document: letter,
      })
    )
    const docId = created.data.id
    const paper = nativePaperDocumentSchema.parse({
      version: 4,
      schemaRevision: 1,
      kind: "letter",
      blocks: [
        {
          id: "body",
          type: "paragraph",
          content: [{ text: "Dear Việt 😀 team", underline: true }],
        },
      ],
      clashes: [],
    })
    await store.db
      .update(paperDocs)
      .set(seedColumns("letter", paper))
      .where(eq(paperDocs.id, docId))
    const shared = z
      .object({ data: z.object({ token: z.string() }) })
      .parse(await command("paper.share", { docId, writer: NATIVE_WRITER }))
    const before = await store.db
      .select()
      .from(paperDocs)
      .where(eq(paperDocs.id, docId))
    const path = `/api/paper/shared/${shared.data.token}`
    for (const writer of [
      undefined,
      { ...NATIVE_WRITER, capabilities: [] },
      { ...NATIVE_WRITER, supportedSchemaRevisions: [2] },
    ]) {
      const refused = await app.request(path, {
        headers: writer ? { "x-paper-writer": JSON.stringify(writer) } : {},
      })
      expect(refused.status).toBe(409)
      expect(refused.headers.get("cache-control")).toBe("no-store")
    }
    const response = await app.request(path, {
      headers: { "x-paper-writer": JSON.stringify(NATIVE_WRITER) },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    const body = z
      .object({ ok: z.literal(true), data: paperSharedViewSchema })
      .strict()
      .parse(await response.json())
    expect(body.data.paper).toEqual(paper)
    expect(body.data).not.toHaveProperty("nativeBasis")
    expect(body.data).not.toHaveProperty("contentVersion")
    const owned = await app.request(`/api/paper/${docId}`, {
      headers: {
        ...authHeaders(cookie),
        "x-paper-writer": JSON.stringify(NATIVE_WRITER),
      },
    })
    expect(owned.status).toBe(200)
    const ownerBody = z
      .object({ data: paperViewSchema })
      .parse(await owned.json())
    expect(ownerBody.data.nativeBasis).toBeDefined()
    expect(ownerBody.data.paper).toEqual(paper)
    expect(
      await store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
    ).toEqual(before)
    await command("paper.unshare", { docId, writer: NATIVE_WRITER })
    const revoked = await app.request(path, {
      headers: { "x-paper-writer": JSON.stringify(NATIVE_WRITER) },
    })
    expect(revoked.status).toBe(404)
    expect(revoked.headers.get("cache-control")).toBe("no-store")
  })

  it.each([blankCv(), letter])(
    "shares only the current $kind and leaves owner state unchanged",
    async (paper) => {
      const created = z.object({ data: z.object({ id: paperIdSchema }) }).parse(
        await command("paper.create", {
          kind: paper.kind,
          name: "Public document",
          document: paper,
        })
      )
      const docId = created.data.id
      const privatePaper = paperDocumentSchema.parse({
        ...paper,
        clashes: [
          {
            id: "private-alternative",
            node:
              paper.kind === "cv"
                ? (paper.header?.id ?? paper.blocks[0]!.id)
                : "body",
            offer: {
              kind: "fields",
              fields:
                paper.kind === "cv"
                  ? paper.header
                    ? { name: privateAlternative }
                    : { content: privateAlternative }
                  : { content: privateAlternative },
            },
            offeredBy: "coach",
            at: "2026-11-15T00:00:00.000Z",
          },
        ],
      })
      await store.db
        .update(paperDocs)
        .set({
          crdtDocument: privatePaper,
          checks: [{ id: "private-check", kind: "import", message: "Private" }],
        })
        .where(eq(paperDocs.id, docId))
      const ownerBefore = await store.db
        .select()
        .from(paperDocs)
        .where(eq(paperDocs.id, docId))
      const shared = z
        .object({ data: z.object({ token: z.string() }) })
        .parse(await command("paper.share", { docId }))
      const response = await app.request(
        `/api/paper/shared/${shared.data.token}`
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      const json: unknown = await response.json()
      const body = z
        .object({ ok: z.literal(true), data: paperSharedViewSchema })
        .strict()
        .parse(json)
      expect(Object.keys(body.data).sort()).toEqual([
        "id",
        "kind",
        "name",
        "paper",
        "templateId",
      ])
      expect(body.data.paper).toEqual(paper)
      expect(JSON.stringify(json)).not.toContain(privateAlternative)
      expect(JSON.stringify(json)).not.toContain("private-check")
      const owned = await app.request(`/api/paper/${docId}`, {
        headers: authHeaders(cookie),
      })
      const ownerBody = z
        .object({ data: paperViewSchema })
        .parse(await owned.json())
      expect(ownerBody.data.paper).toEqual(privatePaper)
      expect(ownerBody.data.checks).toHaveLength(1)
      expect(
        await store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
      ).toEqual(ownerBefore)
      expect(
        paperSharedViewSchema.safeParse({ ...body.data, sourceFileId: null })
          .success
      ).toBe(false)
      expect(
        paperSharedViewSchema.safeParse({ ...body.data, paper: privatePaper })
          .success
      ).toBe(false)
    }
  )
})
