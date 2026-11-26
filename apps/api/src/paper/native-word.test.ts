import { randomUUID } from "node:crypto"
import { catalog, parseFileId, parseUserId } from "@workspace/domain/kernel"
import {
  NATIVE_WRITER,
  nativeProvenanceSchema,
  paperPhotoRef,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { layoutDocumentSchema } from "@workspace/domain/internal/paper-presentation"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, expect, it } from "vitest"
import {
  getDb,
  ownedTaskTransaction,
  transaction,
  withDatabase,
} from "../db/context.js"
import {
  activity,
  files,
  paperDocs,
  paperDocUpdates,
  paperPackageHeads,
  paperPackageVersions,
  user,
} from "../db/schema.js"
import { openStore } from "../test/paper-content.js"
import { richPaper } from "../test/rich-paper.js"
import { withRichSnapshot } from "./content/content-store.js"
import { downloadNativeWord } from "./native-word.js"
import { savedRichWord, portraitBytes } from "./native-word.test-support.js"
import { readPackageZip } from "./import/package-zip.js"
import { parsePackageXml } from "./import/package-xml.js"
import {
  elements,
  attribute,
  textOf,
} from "./native-output/inspect.test-support.js"
import { compileOwnedFlowNativeDocx } from "./owned-word-output.js"
import { readOwnedPhoto } from "./store.js"

const owner = parseUserId("native-word-owner")
const stranger = parseUserId("native-word-stranger")
let store: Awaited<ReturnType<typeof openStore>>
beforeAll(async () => {
  store = await openStore(owner)
  await store.db.insert(user).values({
    id: stranger,
    name: "Other",
    email: "native-word-other@example.com",
  })
})
afterAll(async () => {
  await store.client.close()
})
const inDb = <T>(run: () => Promise<T>) => withDatabase(store.db, run)

it("admits owned semantic portraits without relaxing layout identities, references or geometry", () => {
  const document = richPaper("cv", paperPhotoRef(randomUUID()))
  const header = document.flow.children[0]?.children.find(
    (node) => node.type === "header"
  )
  if (!header || header.type !== "header")
    throw new Error("Missing semantic CV header")
  header.photo = paperPhotoRef(randomUUID())
  expect(richPaperDocumentSchema.parse(document)).toEqual(document)
  for (const photo of [
    "https://example.com/photo.png",
    "paper-photo:invalid",
  ]) {
    expect(
      richPaperDocumentSchema.safeParse({
        ...document,
        flow: {
          ...document.flow,
          children: document.flow.children.map((section) => ({
            ...section,
            children: section.children.map((node) =>
              node.type === "header" ? { ...node, photo } : node
            ),
          })),
        },
      }).success
    ).toBe(false)
  }
  const duplicate = structuredClone(document)
  duplicate.flow.children[0]?.children.push(header)
  expect(richPaperDocumentSchema.safeParse(duplicate).success).toBe(false)
  const geometry = structuredClone(document)
  const section = geometry.flow.children[0]
  if (!section) throw new Error("Missing flow section")
  section.columns = { count: 2, gap: section.page.width }
  expect(richPaperDocumentSchema.safeParse(geometry).success).toBe(false)
  expect(
    layoutDocumentSchema.safeParse({
      profile: "private-layout-2",
      kind: document.kind,
      presentation: document.presentation,
      flow: {
        ...document.flow,
        children: section.children.filter((node) => node.type !== "pageBreak"),
      },
    }).success
  ).toBe(false)
})

async function databaseState() {
  return {
    docs: await getDb().select().from(paperDocs),
    updates: await getDb().select().from(paperDocUpdates),
    files: await getDb().select().from(files),
    activity: await getDb().select().from(activity),
    heads: await getDb().select().from(paperPackageHeads),
    versions: await getDb().select().from(paperPackageVersions),
  }
}

it.each(["cv", "letter"] as const)(
  "downloads an exact saved %s with editable text, formatting, links, page breaks and owned photos without writes",
  async (kind) => {
    const saved = await savedRichWord(store.db, owner, kind)
    await inDb(async () => {
      const before = await databaseState()
      const qualified = await store.registry.read(
        catalog["paper.export"].name,
        saved.input,
        store.actor
      )
      expect(qualified).toMatchObject({
        docId: saved.id,
        kind,
        basis: saved.basis,
      })
      const result = await downloadNativeWord(owner, saved.input)
      expect(result.basis).toEqual(saved.basis)
      expect(result.filename).toBe(`Linh Việt ${kind}.docx`)
      const archive = await readPackageZip(result.bytes)
      expect(archive.files.get("word/media/photo1.png")).toEqual(portraitBytes)
      expect(
        [...archive.files.keys()].filter((name) =>
          name.startsWith("word/media/")
        )
      ).toHaveLength(1)
      const xml = archive.files.get("word/document.xml")
      if (!xml) throw new Error("Missing document XML")
      const document = parsePackageXml(xml)
      expect(textOf(document, document.root)).toContain("Việt e\u0302 😀 Link")
      expect(elements(document.root, "b").length).toBeGreaterThan(0)
      expect(elements(document.root, "hyperlink")).toHaveLength(2)
      expect(
        elements(document.root, "br").map((node) => attribute(node, "type"))
      ).toEqual(["page"])
      expect(elements(document.root, "drawing")).toHaveLength(
        kind === "cv" ? 2 : 1
      )
      expect(elements(document.root, "tbl")).toHaveLength(kind === "cv" ? 2 : 1)
      if (kind === "cv") {
        expect(textOf(document, document.root)).toContain("Linh")
        expect(elements(document.root, "i").length).toBeGreaterThan(0)
        expect(
          elements(document.root, "vAlign").map((node) =>
            attribute(node, "val")
          )
        ).toContain("top")
      }
      expect(await databaseState()).toEqual(before)
    })
  }
)

it("refuses foreign, missing and deleted documents with the same not-found answer", async () => {
  const saved = await savedRichWord(store.db, owner, "cv")
  await inDb(async () => {
    await expect(
      downloadNativeWord(stranger, saved.input)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Document not found",
    })
    await expect(
      downloadNativeWord(owner, { ...saved.input, docId: randomUUID() })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Document not found",
    })
    await getDb().delete(paperDocs).where(eq(paperDocs.id, saved.id))
    await expect(downloadNativeWord(owner, saved.input)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Document not found",
    })
  })
})

it("refuses stale revision, digest, epoch, provenance, writer and kind without mutating data", async () => {
  const saved = await savedRichWord(store.db, owner, "cv")
  await inDb(async () => {
    const before = await databaseState()
    const attempts = [
      { ...saved.input, basis: { ...saved.basis, revision: 1 } },
      { ...saved.input, basis: { ...saved.basis, epoch: 2 } },
      { ...saved.input, basis: { ...saved.basis, digest: "0".repeat(64) } },
      { ...saved.input, writer: NATIVE_WRITER },
      { ...saved.input, kind: "letter" as const },
      {
        ...saved.input,
        basis: {
          ...saved.basis,
          provenance: nativeProvenanceSchema.parse({
            documentVersion: 4,
            schemaRevision: 1,
            writerProtocol: 1,
            requiredCapabilities: ["structured-prose", "underline"],
          }),
        },
      },
    ]
    for (const input of attempts)
      await expect(downloadNativeWord(owner, input)).rejects.toMatchObject({
        code: "CONFLICT",
      })
    expect(await databaseState()).toEqual(before)
  })
})

it.each(["crdtBase", "crdtEpoch", "crdtBaseSeq"] as const)(
  "refuses a missing %s instead of reconstructing or writing a fallback",
  async (column) => {
    const saved = await savedRichWord(store.db, owner, "letter")
    await inDb(async () => {
      await getDb()
        .update(paperDocs)
        .set({ [column]: null })
        .where(eq(paperDocs.id, saved.id))
      const before = await databaseState()
      await expect(
        downloadNativeWord(owner, saved.input)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await databaseState()).toEqual(before)
    })
  }
)

it("refuses a stored projection that differs from the canonical binary", async () => {
  const saved = await savedRichWord(store.db, owner, "letter")
  await inDb(async () => {
    await withRichSnapshot(owner, saved.input, async () => undefined)
    const divergent = structuredClone(saved.document)
    const section = divergent.flow.children[0]
    const paragraph = section?.children.find(
      (node) => node.type === "paragraph"
    )
    if (!paragraph || paragraph.type !== "paragraph")
      throw new Error("Missing paragraph")
    paragraph.content = [{ text: "A different projection" }]
    await getDb()
      .update(paperDocs)
      .set({ crdtDocument: divergent })
      .where(eq(paperDocs.id, saved.id))
    const before = await databaseState()
    await expect(downloadNativeWord(owner, saved.input)).rejects.toMatchObject({
      code: "CONFLICT",
    })
    expect(await databaseState()).toEqual(before)
  })
})

it("owns its transaction and refuses unqualified media reads", async () => {
  const saved = await savedRichWord(store.db, owner, "letter")
  await inDb(async () => {
    await expect(
      transaction(() => downloadNativeWord(owner, saved.input))
    ).rejects.toMatchObject({ code: "AMBIENT_TASK_TRANSACTION" })
    await expect(
      readOwnedPhoto(owner, parseFileId(saved.photo.id), { lock: true })
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(
      await compileOwnedFlowNativeDocx({
        userId: owner,
        document: saved.document,
      })
    ).toMatchObject({ kind: "refused" })
  })
})

it.each(["foreign", "purpose", "signature", "unsupported"] as const)(
  "refuses %s photo media and leaves the document intact",
  async (failure) => {
    const saved = await savedRichWord(store.db, owner, "cv")
    await inDb(async () => {
      if (failure === "foreign")
        await getDb()
          .update(files)
          .set({ userId: stranger })
          .where(eq(files.id, saved.photo.id))
      if (failure === "purpose")
        await getDb()
          .update(files)
          .set({ purpose: "import" })
          .where(eq(files.id, saved.photo.id))
      if (failure === "signature")
        await getDb()
          .update(files)
          .set({ bytes: Buffer.from("not an image") })
          .where(eq(files.id, saved.photo.id))
      if (failure === "unsupported")
        await getDb()
          .update(files)
          .set({ mediaType: "image/webp" })
          .where(eq(files.id, saved.photo.id))
      const before = await databaseState()
      await expect(
        downloadNativeWord(owner, saved.input)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await databaseState()).toEqual(before)
    })
  }
)

it("refuses an unresolved header portrait instead of silently dropping it", async () => {
  const saved = await savedRichWord(store.db, owner, "cv")
  const { version, schemaRevision, ...document } = saved.document
  void version
  void schemaRevision
  const header = document.flow.children[0]?.children.find(
    (node) => node.type === "header"
  )
  if (!header || header.type !== "header") throw new Error("Missing CV header")
  header.photo = `file:${randomUUID()}`
  await inDb(async () => {
    const before = await databaseState()
    expect(
      await ownedTaskTransaction(() =>
        compileOwnedFlowNativeDocx({ userId: owner, document })
      )
    ).toMatchObject({ kind: "refused", reason: "Photo file not found" })
    expect(await databaseState()).toEqual(before)
  })
})
