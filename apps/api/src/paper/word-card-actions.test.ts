import { randomUUID } from "node:crypto"

import {
  coachActor,
  parsePaperId,
  parseUserId,
  personActor,
  type Actor,
} from "@workspace/domain/kernel"
import {
  PAPER_CANVAS_PROFILE,
  PAPER_COACH_WORD_PAGE_NOTE,
} from "@workspace/domain/paper-doc"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import { chats, coachUsage, jobs, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { eq } from "drizzle-orm"
import { readOutline } from "./outline.js"
import { fixturePackage, paragraph } from "./word-package/package-fixtures.js"
import {
  exportWordPackage,
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./word-package/package-store.js"

let backend: Backend
const owner = randomUUID()
const stranger = randomUUID()
const person = personActor(owner)
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)
const lineHandle = /\[line ([0-9a-f-]{36})\] Harbor light/

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

async function mintWordPage(name: string, kind: "cv" | "letter" = "cv") {
  const staged = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name, kind },
    fixturePackage(paragraph("Harbor light"))
  )
  return publishWordPackage(owner, staged.stageId, PAPER_CANVAS_PROFILE)
}

async function listed(actor: Actor = person) {
  return (await registry.read("paper.list", {}, actor)) as {
    id: string
    name: string
    paper?: unknown
    content?: unknown
    note?: string
    format?: string
  }[]
}

function pageText(page: Awaited<ReturnType<typeof readWordPackage>>) {
  return page.regions.map((region) => region.text).join("\n")
}

async function coachTurn() {
  const chatId = randomUUID()
  const turnId = randomUUID()
  await getDb().insert(chats).values({ id: chatId, userId: owner, title: "CV" })
  await getDb().insert(coachUsage).values({
    id: turnId,
    userId: owner,
    chatId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
  return coachActor(owner, chatId, turnId)
}

async function addJob() {
  const created = await registry.execute({
    name: "job.create",
    input: { title: "Engineer", company: "Harbor" },
    actor: person,
  })
  return (created.output as { id: string }).id
}

describe("card menu actions on a Word page", () => {
  it("renames a Word page and Undo puts the old name back", () =>
    run(async () => {
      const page = await mintWordPage("Rename.docx")
      const renamed = await registry.execute({
        name: "paper.update",
        input: { docId: page.docId, patch: { name: "Harbor CV" } },
        actor: person,
      })
      expect(renamed.output).toMatchObject({
        id: page.docId,
        name: "Harbor CV",
      })
      expect(renamed.output).not.toHaveProperty("previous")
      expect(
        (await listed()).find((item) => item.id === page.docId)?.name
      ).toBe("Harbor CV")
      const read = await readWordPackage(owner, { docId: page.docId })
      expect(read.name).toBe("Harbor CV")
      expect(read.revision).toBe(page.revision)
      await registry.execute({
        name: "paper.update",
        input: { docId: page.docId, patch: { name: "Rename" } },
        actor: person,
      })
      expect(
        (await listed()).find((item) => item.id === page.docId)?.name
      ).toBe("Rename")
    }))

  it("duplicates a Word page with the same content, its own history and no Job link", () =>
    run(async () => {
      const page = await mintWordPage("Source.docx")
      const jobId = await addJob()
      await registry.execute({
        name: "job.linkPaper",
        input: { jobId, docId: page.docId, kind: "cv" },
        actor: person,
      })
      const copied = await registry.execute({
        name: "paper.duplicate",
        input: { docId: page.docId },
        actor: person,
      })
      const copy = copied.output as { id: string; name: string }
      expect(copy.id).not.toBe(page.docId)
      expect(copy.name).toBe("Copy of Source.docx")
      expect(copied.reversal?.command).toBe("paper.delete")
      expect((await listed()).some((item) => item.id === copy.id)).toBe(true)
      const original = await readWordPackage(owner, { docId: page.docId })
      const duplicate = await readWordPackage(owner, { docId: copy.id })
      expect(duplicate.revision).not.toBe(original.revision)
      expect(pageText(duplicate)).toBe(pageText(original))
      const originalBytes = await exportWordPackage(
        owner,
        page.docId,
        original.revision
      )
      const copyBytes = await exportWordPackage(
        owner,
        copy.id,
        duplicate.revision
      )
      expect(Buffer.compare(copyBytes.bytes, originalBytes.bytes)).toBe(0)
      const reopened = await stageWordPackage(
        owner,
        { requestId: randomUUID(), name: "Reopened.docx", kind: "cv" },
        copyBytes.bytes
      )
      const again = await readWordPackage(owner, {
        docId: (await publishWordPackage(owner, reopened.stageId)).docId,
      })
      expect(pageText(again)).toBe(pageText(original))
      const job = (await registry.read("job.get", { jobId }, person)) as {
        linked: { cv: { id: string } | null }
      }
      expect(job.linked.cv?.id).toBe(page.docId)
      await registry.execute({
        name: "activity.undo",
        input: { activityId: copied.activityId },
        actor: person,
      })
      expect((await listed()).some((item) => item.id === copy.id)).toBe(false)
    }))

  it("deletes a Word page everywhere and Undo brings back its content, revision and Job link", () =>
    run(async () => {
      const page = await mintWordPage("Delete.docx")
      const jobId = await addJob()
      await registry.execute({
        name: "job.linkPaper",
        input: { jobId, docId: page.docId, kind: "cv" },
        actor: person,
      })
      const coach = await coachTurn()
      const outline = await readOutline(
        parseUserId(owner),
        parsePaperId(page.docId),
        undefined
      )
      const handle = lineHandle.exec(outline.outline)?.[1]
      if (!handle) throw new Error("missing line handle")
      const proposed = await registry.execute({
        name: "paper.edit",
        input: {
          docId: page.docId,
          basedOn: page.revision,
          edits: [{ op: "setText", handle, text: "Harbor lamp" }],
        },
        actor: coach,
      })
      expect(proposed.pending).toBe(true)
      const deleted = await registry.execute({
        name: "paper.delete",
        input: { docId: page.docId },
        actor: person,
      })
      expect(deleted.output).toEqual({
        id: page.docId,
        format: "word",
        name: "Delete.docx",
      })
      expect(deleted.reversal?.command).toBe("paper.recover")
      expect(deleted.activityId).toBeTruthy()
      expect((await listed()).some((item) => item.id === page.docId)).toBe(
        false
      )
      expect((await listed(coach)).some((item) => item.id === page.docId)).toBe(
        false
      )
      await expect(
        registry.read("paper.read", { docId: page.docId }, person)
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      await expect(
        registry.read("paper.outline", { docId: page.docId }, coach)
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      const unlinked = (await registry.read("job.get", { jobId }, person)) as {
        linked: { cv: unknown }
      }
      expect(unlinked.linked.cv).toBeNull()
      await expect(
        registry.execute({
          name: "actions.approve",
          input: { pendingActionId: proposed.pendingActionId },
          actor: person,
        })
      ).rejects.toThrow()
      await expect(
        registry.read(
          "paper.read",
          { view: "trash", docId: page.docId },
          person
        )
      ).resolves.toEqual({ docId: page.docId, deleted: true })
      await registry.execute({
        name: "activity.undo",
        input: { activityId: deleted.activityId },
        actor: person,
      })
      const back = await readWordPackage(owner, { docId: page.docId })
      expect(back.revision).toBe(page.revision)
      expect(pageText(back)).toContain("Harbor light")
      expect(pageText(back)).not.toContain("Harbor lamp")
      expect(
        (await listed()).find((item) => item.id === page.docId)?.name
      ).toBe("Delete.docx")
      const relinked = (await registry.read("job.get", { jobId }, person)) as {
        linked: { cv: { id: string } | null }
      }
      expect(relinked.linked.cv?.id).toBe(page.docId)
      await expect(
        registry.read(
          "paper.read",
          { view: "trash", docId: page.docId },
          person
        )
      ).resolves.toEqual({ docId: page.docId, deleted: false })
    }))

  it("keeps a Job's newer link when Undo brings a deleted page back", () =>
    run(async () => {
      const page = await mintWordPage("Older link.docx")
      const other = await mintWordPage("Newer link.docx")
      const jobId = await addJob()
      await registry.execute({
        name: "job.linkPaper",
        input: { jobId, docId: page.docId, kind: "cv" },
        actor: person,
      })
      const deleted = await registry.execute({
        name: "paper.delete",
        input: { docId: page.docId },
        actor: person,
      })
      await registry.execute({
        name: "job.linkPaper",
        input: { jobId, docId: other.docId, kind: "cv" },
        actor: person,
      })
      await registry.execute({
        name: "activity.undo",
        input: { activityId: deleted.activityId },
        actor: person,
      })
      const job = (await registry.read("job.get", { jobId }, person)) as {
        linked: { cv: { id: string } | null }
      }
      expect(job.linked.cv?.id).toBe(other.docId)
      expect((await listed()).some((item) => item.id === page.docId)).toBe(true)
    }))

  it("refuses another person's Word page the same as an unknown id", () =>
    run(async () => {
      const page = await mintWordPage("Private.docx")
      const outsider = personActor(stranger)
      for (const [name, input] of [
        ["paper.update", { docId: page.docId, patch: { name: "Taken" } }],
        ["paper.duplicate", { docId: page.docId }],
        ["paper.delete", { docId: page.docId }],
        ["paper.update", { docId: randomUUID(), patch: { name: "Taken" } }],
        ["paper.duplicate", { docId: randomUUID() }],
        ["paper.delete", { docId: randomUUID() }],
      ] as const)
        await expect(
          registry.execute({ name, input, actor: outsider })
        ).rejects.toMatchObject({
          code: "NOT_FOUND",
          message: "Document not found",
        })
      expect(
        (await listed()).find((item) => item.id === page.docId)?.name
      ).toBe("Private.docx")
      const [row] = await getDb()
        .select({ id: jobs.id })
        .from(jobs)
        .where(eq(jobs.cvPackageId, page.docId))
      expect(row).toBeUndefined()
    }))

  it("keeps an older document's delete as it was, with no Undo", () =>
    run(async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Older CV" },
        actor: person,
      })
      const docId = (created.output as { id: string }).id
      const deleted = await registry.execute({
        name: "paper.delete",
        input: { docId },
        actor: person,
      })
      expect(deleted.output).toEqual({ id: docId })
      expect(deleted.reversal).toBeNull()
      expect(deleted.activityId).toBeNull()
      expect((await listed()).some((item) => item.id === docId)).toBe(false)
    }))
})

describe("the Coach's list and get tools on a Word page", () => {
  it("never hand the Coach a stand-in blank body as the page's content", () =>
    run(async () => {
      const page = await mintWordPage("Word CV.docx")
      const coach = await coachTurn()
      const item = (await listed(coach)).find((row) => row.id === page.docId)
      expect(item).toMatchObject({
        format: "word",
        content: null,
        note: PAPER_COACH_WORD_PAGE_NOTE,
      })
      expect(item).not.toHaveProperty("paper")
      const outline = (await registry.read(
        "paper.outline",
        { docId: page.docId },
        coach
      )) as Record<string, unknown>
      expect(String(outline.outline)).toContain("Harbor light")
      const forPerson = (await listed()).find((row) => row.id === page.docId)
      expect(forPerson).toHaveProperty("paper")
      const tools = await registry.tools(coach)
      expect(
        tools.find((tool) => tool.name === "paper.list")?.description
      ).toContain("paper_outline")
    }))
})
