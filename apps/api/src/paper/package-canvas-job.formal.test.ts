import { randomUUID } from "node:crypto"

import { personActor, type WordFile, type WordPage } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import { activity, paperPackageHeads, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { publishWordPackage, stageWordPackage } from "./package-store.js"
import { exportWord, open } from "./word/document.js"

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
})

afterAll(async () => {
  await backend?.close()
})

async function seed() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

function field(value: unknown, key: string) {
  return (value as Record<string, unknown>)[key]
}

const DRAFT = [
  "Dear Northwind team,",
  "I would like to join Northwind as an Associate PM.",
  "Kind regards,",
]

describe("a Letter drafted from a Job", () => {
  it("opens as a Word page with the draft, linked to the Job, and downloads as Word", () =>
    run(async () => {
      const owner = await seed()
      const actor = personActor(owner)
      const registry = installRegistry()
      const job = await registry.execute({
        name: "job.create",
        input: { title: "Associate PM", company: "Northwind" },
        actor,
      })
      const jobId = String(field(job.output, "id"))
      const minted = await registry.execute({
        name: "paper.canvas",
        input: {
          op: "mint",
          label: "letter",
          name: "Cover letter, Northwind",
          jobId,
          lines: DRAFT,
        },
        actor,
        idempotencyKey: randomUUID(),
      })
      const docId = String(field(minted.output, "docId"))
      const revision = String(field(minted.output, "revision"))
      expect(field(minted.output, "generation")).toBe("package")
      expect(field(minted.output, "kind")).toBe("letter")
      expect(field(minted.output, "name")).toBe("Cover letter, Northwind")

      const page = (await open(owner, {
        kind: "read",
        doc: docId,
      })) as WordPage
      expect(
        page.paragraphs.map((paragraph) => paragraph.text).filter(Boolean)
      ).toEqual(DRAFT)
      expect(page.paragraphs.some((paragraph) => paragraph.held)).toBe(false)

      const linked = await registry.read("job.get", { jobId }, actor)
      expect(field(linked, "letterDocId")).toBe(docId)
      expect(field(linked, "linked")).toMatchObject({
        letter: { id: docId, name: "Cover letter, Northwind" },
      })
      const listed = (await registry.read("job.list", {}, actor)) as unknown[]
      expect(listed.map((row) => field(row, "letterDocId"))).toEqual([docId])

      const receipts = await getDb()
        .select({ summary: activity.summary })
        .from(activity)
        .where(eq(activity.userId, owner))
      expect(receipts.map((row) => row.summary)).toEqual(
        expect.arrayContaining([
          "Wrote on the page",
          "You linked Cover letter, Northwind",
        ])
      )

      const file = (await exportWord(owner, docId, revision)) as WordFile
      expect(file.mediaType).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
      const stage = await stageWordPackage(
        owner,
        { requestId: randomUUID(), name: "Downloaded.docx", kind: "letter" },
        file.bytes
      )
      const published = await publishWordPackage(owner, stage.stageId)
      const reopened = (await open(owner, {
        kind: "read",
        doc: published.docId,
      })) as WordPage
      expect(
        reopened.paragraphs.map((paragraph) => paragraph.text).filter(Boolean)
      ).toEqual(DRAFT)
    }))

  it("relinks the Job from an older letter to a Word page and unlinks it", () =>
    run(async () => {
      const owner = await seed()
      const actor = personActor(owner)
      const registry = installRegistry()
      const job = await registry.execute({
        name: "job.create",
        input: { title: "Analyst", company: "Contoso" },
        actor,
      })
      const jobId = String(field(job.output, "id"))
      const older = await registry.execute({
        name: "paper.create",
        input: { kind: "letter", name: "Older letter" },
        actor,
      })
      const olderId = String(field(older.output, "id"))
      await registry.execute({
        name: "job.linkPaper",
        input: { jobId, docId: olderId, kind: "letter" },
        actor,
      })
      const minted = await registry.execute({
        name: "paper.canvas",
        input: { op: "mint", label: "letter", jobId },
        actor,
        idempotencyKey: randomUUID(),
      })
      const docId = String(field(minted.output, "docId"))
      const read = async () => registry.read("job.get", { jobId }, actor)
      expect(field(await read(), "letterDocId")).toBe(docId)
      expect(field(await read(), "linked")).toMatchObject({
        letter: { id: docId, name: "Cover letter" },
      })
      await registry.execute({
        name: "job.linkPaper",
        input: { jobId, docId: olderId, kind: "letter" },
        actor,
      })
      expect(field(await read(), "letterDocId")).toBe(olderId)
      await registry.execute({
        name: "job.linkPaper",
        input: { jobId, docId, kind: "letter" },
        actor,
      })
      expect(field(await read(), "letterDocId")).toBe(docId)
      await expect(
        registry.execute({
          name: "job.linkPaper",
          input: { jobId, docId, kind: "cv" },
          actor,
        })
      ).rejects.toThrow("Document not found")
      await registry.execute({
        name: "job.unlinkPaper",
        input: { jobId, kind: "letter" },
        actor,
      })
      expect(field(await read(), "letterDocId")).toBeNull()
    }))

  it("refuses another person's Job and makes no page", () =>
    run(async () => {
      const owner = await seed()
      const stranger = await seed()
      const registry = installRegistry()
      const job = await registry.execute({
        name: "job.create",
        input: { title: "Designer", company: "Fabrikam" },
        actor: personActor(owner),
      })
      await expect(
        registry.execute({
          name: "paper.canvas",
          input: {
            op: "mint",
            label: "letter",
            jobId: String(field(job.output, "id")),
            lines: ["Dear team,"],
          },
          actor: personActor(stranger),
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow()
      expect(
        await getDb()
          .select({ docId: paperPackageHeads.docId })
          .from(paperPackageHeads)
          .where(eq(paperPackageHeads.userId, stranger))
      ).toEqual([])
    }))
})
