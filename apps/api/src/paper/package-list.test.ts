import { randomUUID } from "node:crypto"

import {
  PAPER_CANVAS_PROFILE,
  PAPER_COACH_WORD_PAGE_NOTE,
  coachActor,
  parsePaperId,
  parseUserId,
  personActor,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { registry } from "../registry/registry.js"
import { installRegistry } from "../install.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { readOutline } from "./outline.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import { publishWordPackage, stageWordPackage } from "./package-store.js"
import { listPapers } from "./store.js"

let backend: Backend
const owner = randomUUID()
const stranger = randomUUID()
const bytes = fixturePackage(paragraph("Harbor light"))
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  installRegistry()
  backend = await openBackend()
  await backend.db.insert(user).values(
    [owner, stranger].map((id) => ({
      id,
      name: id,
      email: `${id}@test.invalid`,
    }))
  )
})

afterAll(async () => {
  await backend?.close()
})

describe("Word pages in the document list", () => {
  it("lists a written page and an imported page, and reads them, for their owner only", () =>
    run(async () => {
      const staged = await stageWordPackage(
        owner,
        {
          requestId: randomUUID(),
          name: "Page.docx",
          kind: "letter",
        },
        bytes
      )
      const plain = await stageWordPackage(
        owner,
        {
          requestId: randomUUID(),
          name: "Imported.docx",
          kind: "letter",
        },
        bytes
      )
      const imported = await publishWordPackage(owner, plain.stageId)
      const head = await publishWordPackage(
        owner,
        staged.stageId,
        PAPER_CANVAS_PROFILE
      )
      const ownerId = parseUserId(owner)
      const listed = await listPapers(ownerId)
      const page = listed.find((item) => item.id === head.docId)
      expect(page).toMatchObject({
        name: "Page.docx",
        kind: "letter",
        format: "word",
      })
      expect(listed.filter((item) => item.id === imported.docId)).toEqual([
        expect.objectContaining({
          name: "Imported.docx",
          kind: "letter",
          format: "word",
        }),
      ])
      const coachListed = await registry.read(
        "paper.list",
        {},
        coachActor(owner, randomUUID(), "turn-list")
      )
      const coachIds = (Array.isArray(coachListed) ? coachListed : []).map(
        (item: unknown) =>
          item && typeof item === "object" && "id" in item ? item.id : null
      )
      expect(coachIds).toEqual(
        expect.arrayContaining([imported.docId, head.docId])
      )
      const coachImported = (
        Array.isArray(coachListed) ? coachListed : []
      ).filter((item: unknown) =>
        item && typeof item === "object" && "id" in item
          ? item.id === imported.docId
          : false
      )
      expect(coachImported).toEqual([
        expect.objectContaining({
          format: "word",
          note: PAPER_COACH_WORD_PAGE_NOTE,
        }),
      ])
      expect(coachImported[0]).not.toHaveProperty("paper")
      expect(
        (await listPapers(parseUserId(stranger))).some(
          (item) => item.id === imported.docId
        )
      ).toBe(false)
      expect(
        (await listPapers(parseUserId(stranger))).some(
          (item) => item.id === head.docId
        )
      ).toBe(false)
      const docId = parsePaperId(head.docId)
      await expect(
        registry.read("paper.read", { view: "info", docId }, personActor(owner))
      ).resolves.toMatchObject({
        id: head.docId,
        name: "Page.docx",
        format: "word",
      })
      const outline = await readOutline(ownerId, docId, undefined)
      expect(outline.revision).toBe(head.revision)
      expect(outline.outline).toContain("Harbor light")
      expect(outline.outline).toContain(`Saved revision ${head.revision}`)
      expect(outline.outline).toMatch(/\[line [a-f0-9-]{36}\]/)
      const importedId = parsePaperId(imported.docId)
      const importedOutline = await readOutline(ownerId, importedId, undefined)
      expect(importedOutline.revision).toBe(imported.revision)
      expect(importedOutline.outline).toContain("Harbor light")
      expect(importedOutline.outline).toMatch(/\[line [a-f0-9-]{36}\]/)
      await expect(
        registry.read(
          "paper.read",
          { view: "info", docId: importedId },
          personActor(owner)
        )
      ).resolves.toMatchObject({
        id: imported.docId,
        name: "Imported.docx",
        format: "word",
      })
      await expect(
        readOutline(parseUserId(stranger), docId, undefined)
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    }))
})
