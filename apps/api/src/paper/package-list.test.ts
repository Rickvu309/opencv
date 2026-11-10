import { randomUUID } from "node:crypto"

import {
  PAPER_CANVAS_PROFILE,
  coachActor,
  parsePaperId,
  parseUserId,
  personActor,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { registry } from "../registry/registry.js"
import { installRegistry } from "../registry/install.js"
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

describe("a minted writing page in the document list", () => {
  it("lists and reads the page for its owner only", () =>
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
      await publishWordPackage(owner, plain.stageId)
      const head = await publishWordPackage(
        owner,
        staged.stageId,
        PAPER_CANVAS_PROFILE
      )
      const ownerId = parseUserId(owner)
      const listed = await listPapers(ownerId)
      const page = listed.find((item) => item.id === head.docId)
      expect(page).toMatchObject({ name: "Page.docx", kind: "letter" })
      expect(listed.some((item) => item.name === "Imported.docx")).toBe(false)
      expect(
        (await listPapers(parseUserId(stranger))).some(
          (item) => item.id === head.docId
        )
      ).toBe(false)
      const docId = parsePaperId(head.docId)
      await expect(
        registry.read("paper.get", { docId }, personActor(owner))
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      await expect(
        registry.read(
          "paper.get",
          { docId },
          coachActor(owner, randomUUID(), "turn-1")
        )
      ).resolves.toMatchObject({ id: head.docId, name: "Page.docx" })
      const outline = await readOutline(ownerId, docId, undefined)
      expect(outline.outline).toContain("Harbor light")
      expect(outline.outline).toContain(`Saved revision ${head.revision}`)
      expect(outline.outline).toMatch(/\[t_[a-f0-9]{64}\]/)
      await expect(
        readOutline(parseUserId(stranger), docId, undefined)
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    }))
})
