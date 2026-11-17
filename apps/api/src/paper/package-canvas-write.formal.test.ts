import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import { coachActor, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import { chats, coachUsage, paperPackageHeads, user } from "../db/schema.js"
import { bindCatalog } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { registerPaper } from "./commands.js"
import { undo } from "./word/document.js"
import { implementation as readWord } from "./operations/read/server.js"
import {
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./package-store.js"
const loaded = createRequire(import.meta.url)(
  "../../../../scripts/lib/paper-canvas-bytes.mjs"
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
  const value = new Registry()
  registerPaper(value)
  bindCatalog(value, { "paper.read": readWord })
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

async function canvas(owner: string, input: unknown) {
  return registry().execute({
    name: "paper.canvas",
    input,
    actor: personActor(owner),
    idempotencyKey: randomUUID(),
  })
}

function writingRegion(page: Awaited<ReturnType<typeof readWordPackage>>) {
  const region = page.regions.find(
    (item) => item.kind === "locked" && item.reason.code === "EMPTY_TARGET"
  )
  if (!region || region.kind !== "locked" || !region.paragraph)
    throw new Error("Missing empty paragraph")
  return region
}

describe("the first words on a minted page", () => {
  it("reads the empty paragraph id and saves text with the same receipt", () =>
    run(async () => {
      const id = await seed()
      const minted = await canvas(id, { op: "mint", label: "letter" })
      const output = minted.output as {
        docId: string
        revision: string
        generation: string
        restore: null
      }
      expect(output.generation).toBe("package")
      expect(output.restore).toBeNull()
      const page = await readWordPackage(id, { docId: output.docId })
      const empty = writingRegion(page)
      expect(empty.text).toBe("")
      expect(empty.paragraph).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
      expect(page.regions).toHaveLength(1)
      const wrote = await canvas(id, {
        op: "write",
        batch: {
          doc: output.docId,
          basedOn: output.revision,
          ops: [{ op: "setText", handle: empty.paragraph, text: "Hi" }],
        },
      })
      const saved = wrote.output as {
        docId: string
        revision: string
        generation: string
        name: string
        kind: string
        packageHash: string
        byteSize: number
        incarnation: string
        restore: { id: string; digest: string }
      }
      expect(saved.generation).toBe("package")
      expect(saved.docId).toBe(output.docId)
      expect(saved.revision).not.toBe(output.revision)
      expect(saved.restore.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
      expect(saved.restore.digest).toMatch(/^[a-f0-9]{64}$/)
      const next = await readWordPackage(id, { docId: output.docId })
      const text = next.regions.find((item) => item.kind === "editable")
      if (!text || text.kind !== "editable") throw new Error("Missing text")
      expect(text.text).toBe("Hi")
      expect(text.paragraph).toBe(empty.paragraph)
      await expect(
        canvas(id, {
          op: "write",
          batch: {
            doc: output.docId,
            basedOn: output.revision,
            ops: [{ op: "setText", handle: empty.paragraph, text: "Yo" }],
          },
        })
      ).rejects.toThrow(
        "This Word document has changed. Read it again before editing."
      )
      expect((await headOf(output.docId)).revision).toBe(saved.revision)
      expect(wrote.reversal?.command).toBe("paper.undoWord")
      const restored = await undo(id, {
        doc: output.docId,
        revision: saved.revision,
        restore: output.revision,
      })
      if (restored.refused) throw new Error(restored.message)
      const undone = await readWordPackage(id, { docId: output.docId })
      const again = writingRegion(undone)
      expect(again.text).toBe("")
      expect(again.paragraph).toBe(empty.paragraph)
      expect((await headOf(output.docId)).revision).toBe(output.revision)
    }))

  it("refuses a line that is not on the imported page", () =>
    run(async () => {
      const id = await seed()
      const stage = await stageWordPackage(
        id,
        { requestId: randomUUID(), name: "Imported.docx", kind: "letter" },
        loaded.mintBlankBytes()
      )
      const published = await publishWordPackage(id, stage.stageId)
      const page = await readWordPackage(id, { docId: published.docId })
      const empty = page.regions.find((item) => item.kind === "locked")
      if (!empty || empty.kind !== "locked") throw new Error("Missing region")
      expect(empty.paragraph).toBeTruthy()
      const head = await headOf(published.docId)
      const paragraph = "a11a11a1-a11a-4a11-8a11-a11a11a11a11"
      await expect(
        canvas(id, {
          op: "write",
          batch: {
            doc: published.docId,
            basedOn: published.revision,
            ops: [{ op: "setText", handle: paragraph, text: "Hi" }],
          },
        })
      ).rejects.toThrow(
        "This Word document has changed. Read it again before editing."
      )
      expect((await headOf(published.docId)).revision).toBe(head.revision)
      expect((await headOf(published.docId)).canvasProfile).toBeNull()
    }))

  it("refuses the Coach and a break in the first words", () =>
    run(async () => {
      const id = await seed()
      const chatId = randomUUID()
      const turnId = randomUUID()
      await getDb()
        .insert(chats)
        .values({ id: chatId, userId: id, title: "Review" })
      await getDb().insert(coachUsage).values({
        id: turnId,
        userId: id,
        chatId,
        plan: "free",
        mode: "free",
        provider: "fake",
        model: "fake",
      })
      const minted = await canvas(id, { op: "mint", label: "letter" })
      const output = minted.output as { docId: string; revision: string }
      const page = await readWordPackage(id, { docId: output.docId })
      const empty = writingRegion(page)
      await expect(
        registry().execute({
          name: "paper.canvas",
          input: {
            op: "write",
            batch: {
              doc: output.docId,
              basedOn: output.revision,
              ops: [{ op: "setText", handle: empty.paragraph, text: "Hi" }],
            },
          },
          actor: coachActor(id, chatId, turnId),
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow("The Coach cannot do this")
      expect((await headOf(output.docId)).revision).toBe(output.revision)
      await expect(
        canvas(id, {
          op: "write",
          batch: {
            doc: output.docId,
            basedOn: output.revision,
            ops: [{ op: "setText", handle: empty.paragraph, text: "a\nb" }],
          },
        })
      ).rejects.toThrow("Text must not contain control characters or newlines.")
      await expect(
        canvas(id, {
          op: "write",
          batch: { doc: output.docId, basedOn: output.revision, ops: [] },
        })
      ).rejects.toThrow()
      expect((await headOf(output.docId)).revision).toBe(output.revision)
    }))
})
