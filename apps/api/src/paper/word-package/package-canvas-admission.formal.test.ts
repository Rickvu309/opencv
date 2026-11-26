import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import { personActor } from "@workspace/domain/kernel"
import { PAPER_CANVAS_PROFILE } from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../../db/context.js"
import {
  files,
  paperPackageHeads,
  paperPackageVersions,
  user,
} from "../../db/schema.js"
import {
  openBackend,
  type Backend,
} from "../../test/registry-formal-support.js"
import { paperRegistry } from "../paper-registry.test-support.js"
import { publishWordPackage, stageWordPackage } from "./package-store.js"
import { open } from "./word/document.js"

const loaded = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
) as { mintBlankBytes: () => Uint8Array }

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
})

afterAll(async () => {
  await backend?.close()
})

function registry() {
  const value = paperRegistry()
  return value
}

async function seed() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

async function headOf(docId: string) {
  const [head] = await getDb()
    .select()
    .from(paperPackageHeads)
    .where(eq(paperPackageHeads.docId, docId))
  if (!head) throw new Error("Missing head")
  return head
}

async function imported(owner: string) {
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "Imported.docx", kind: "letter" },
    loaded.mintBlankBytes()
  )
  const published = await publishWordPackage(owner, stage.stageId)
  const [version] = await getDb()
    .select({ sidecar: paperPackageVersions.sidecar })
    .from(paperPackageVersions)
    .where(eq(paperPackageVersions.revision, published.revision))
  const paragraphs = (version?.sidecar as { paragraphs: { key: string }[] })
    .paragraphs
  return { ...published, paragraph: paragraphs[0]!.key }
}

async function splitAtStart(owner: string, docId: string, handle: string) {
  const page = await open(owner, { kind: "read", doc: docId })
  if ("refused" in page) throw new Error(page.message)
  const line = page.paragraphs.find((paragraph) => paragraph.handle === handle)
  return {
    op: "write",
    batch: {
      doc: docId,
      basedOn: page.revision,
      ops: [
        { op: "setText", handle, text: "" },
        { op: "insert", after: handle, text: line?.text ?? "" },
      ],
    },
  }
}

async function canvas(owner: string, input: unknown) {
  return registry().execute({
    name: "paper.canvas",
    input,
    actor: personActor(owner),
    idempotencyKey: randomUUID(),
  })
}

describe("canvas admits only a page the server minted", () => {
  it("splits an ordinary imported paragraph and refuses a caret past the line", () =>
    run(async () => {
      const id = await seed()
      const doc = await imported(id)
      expect((await headOf(doc.docId)).canvasProfile).toBeNull()
      await expect(
        canvas(id, {
          op: "write",
          batch: {
            doc: doc.docId,
            basedOn: doc.revision,
            ops: [
              { op: "setText", handle: doc.paragraph, text: "Hi", caret: 9 },
            ],
          },
        })
      ).rejects.toThrow(
        "The caret is outside this line's words. No document was changed."
      )
      expect((await headOf(doc.docId)).revision).toBe(doc.revision)
      const split = await canvas(
        id,
        await splitAtStart(id, doc.docId, doc.paragraph)
      )
      const saved = split.output as { docId: string; revision: string }
      expect(saved.docId).toBe(doc.docId)
      expect(saved.revision).not.toBe(doc.revision)
      const head = await headOf(doc.docId)
      expect(head.revision).toBe(saved.revision)
      expect(head.canvasProfile).toBeNull()
    }))

  it("rejects a client claim of the minted profile", () =>
    run(async () => {
      const id = await seed()
      const doc = await imported(id)
      await expect(
        canvas(id, {
          op: "mint",
          label: "letter",
          canvasProfile: PAPER_CANVAS_PROFILE,
        })
      ).rejects.toThrow("Unrecognized key")
      await expect(
        stageWordPackage(
          id,
          {
            requestId: randomUUID(),
            name: "Imported.docx",
            kind: "letter",
            canvasProfile: PAPER_CANVAS_PROFILE,
          },
          loaded.mintBlankBytes()
        )
      ).rejects.toThrow("Unrecognized key")
      await expect(
        canvas(id, {
          ...(await splitAtStart(id, doc.docId, doc.paragraph)),
          canvasProfile: PAPER_CANVAS_PROFILE,
        })
      ).rejects.toThrow("Unrecognized key")
      expect((await headOf(doc.docId)).canvasProfile).toBeNull()
    }))

  it("refuses minted bytes that no longer match the stored hash", () =>
    run(async () => {
      const id = await seed()
      const minted = await canvas(id, { op: "mint", label: "letter" })
      const output = minted.output as { docId: string; revision: string }
      expect((await headOf(output.docId)).canvasProfile).toBe(
        PAPER_CANVAS_PROFILE
      )
      const [version] = await getDb()
        .select({
          fileId: paperPackageVersions.fileId,
          sidecar: paperPackageVersions.sidecar,
        })
        .from(paperPackageVersions)
        .where(eq(paperPackageVersions.revision, output.revision))
      if (!version) throw new Error("Missing version")
      const [file] = await getDb()
        .select({ bytes: files.bytes })
        .from(files)
        .where(eq(files.id, version.fileId))
      if (!file) throw new Error("Missing file")
      const bytes = Buffer.from(file.bytes)
      bytes[0] = bytes[0] === 88 ? 89 : 88
      await getDb()
        .update(files)
        .set({ bytes })
        .where(eq(files.id, version.fileId))
      const paragraph = (version.sidecar as { paragraphs: { key: string }[] })
        .paragraphs[0]!.key
      await expect(
        canvas(id, {
          op: "write",
          batch: {
            doc: output.docId,
            basedOn: output.revision,
            ops: [
              { op: "setText", handle: paragraph, text: "" },
              { op: "insert", after: paragraph, text: "" },
            ],
          },
        })
      ).rejects.toThrow(
        "This Word version is incomplete. No document was changed."
      )
      expect((await headOf(output.docId)).revision).toBe(output.revision)
    }))
})
