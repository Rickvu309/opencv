import { randomUUID } from "node:crypto"

import {
  coachActor,
  delegateActorSchema,
  type WordPage,
  type WordRefusal,
} from "@workspace/domain"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { coachInstructions } from "../coach/index.js"
import { getDb, withDatabase } from "../db/context.js"
import {
  agentConnections,
  chats,
  coachUsage,
  oauthClient,
  user,
} from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import {
  fixturePackage,
  paragraph,
  run as wordRun,
} from "./package-fixtures.js"
import { publishWordPackage, stageWordPackage } from "./package-store.js"
import { apply, open } from "./word/document.js"

let backend: Backend
const owner = randomUUID()
const connectionId = randomUUID()
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  installRegistry()
  backend = await openBackend()
  await backend.db.insert(user).values({
    id: owner,
    name: owner,
    email: `${owner}@test.invalid`,
  })
  await backend.db.insert(oauthClient).values({
    id: "word-batch-client",
    clientId: "word-batch-client",
    redirectUris: ["http://localhost/callback"],
  })
  await backend.db.insert(agentConnections).values({
    id: connectionId,
    userId: owner,
    clientId: "word-batch-client",
    authorizationCodeId: "word-batch-code",
    name: "Paper agent",
    audience: "http://localhost/mcp",
    scopes: ["paper.read", "paper.write"],
    resources: { kind: "none" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt: new Date(Date.now() + 600_000),
  })
})

afterAll(async () => {
  await backend?.close()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function pageOf(value: WordPage | WordRefusal): WordPage {
  if ("refused" in value) throw new Error(value.message)
  return value
}

async function head(doc: string) {
  return pageOf(await open(owner, { kind: "read", doc }))
}

async function words(doc: string) {
  return (await head(doc)).paragraphs.map((line) => line.text)
}

async function coach() {
  const chatId = randomUUID()
  const turnId = randomUUID()
  await getDb().insert(chats).values({ id: chatId, userId: owner, title: "W" })
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

function delegate() {
  return delegateActorSchema.parse({
    type: "delegate",
    userId: owner,
    connectionId,
    name: "Paper agent",
    scopes: ["paper.read", "paper.write"],
    resources: "none",
    reads: "allow",
    writes: "approval",
  })
}

async function blank() {
  return pageOf(
    await open(owner, { kind: "mint", name: "Letter", label: "letter" })
  )
}

async function imported(body: string) {
  const staged = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "Imported.docx", kind: "cv" },
    fixturePackage(body)
  )
  const published = await publishWordPackage(owner, staged.stageId)
  return head(published.docId)
}

type Actor = Awaited<ReturnType<typeof coach>> | ReturnType<typeof delegate>

async function propose(actor: Actor, page: WordPage, edits: unknown[]) {
  const proposed = await registry.execute({
    name: "paper.edit",
    input: { docId: page.doc, basedOn: page.revision, edits },
    actor,
    idempotencyKey: randomUUID(),
  })
  if (!proposed.pending) throw new Error("expected a pending proposal")
  return proposed as typeof proposed & { pendingActionId: string }
}

async function approve(pendingActionId: string) {
  const receipt = await registry.approve(owner, pendingActionId)
  if (!receipt) throw new Error("approve returned no activity")
  return receipt
}

describe("the Coach and own agents send Word batches through paper.edit", () => {
  it("writes first words on a blank page only after the person approves, and Undo puts the blank page back", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await blank()
      const empty = page.paragraphs[0]
      if (!empty) throw new Error("blank page has no line")
      const actor = await coach()
      const outline = await registry.read(
        "paper.outline",
        { docId: page.doc },
        actor
      )
      expect(JSON.stringify(outline)).toContain(
        `[line ${empty.handle}] (empty line)`
      )
      const told = coachInstructions("{}")
      expect(told).toContain("setText")
      expect(told).toContain("insert")
      expect(told).toContain("delete")
      const proposed = await propose(actor, page, [
        { op: "setText", handle: empty.handle, text: "Dear Ada," },
      ])
      expect(proposed.review).toMatchObject({
        operations: [{ op: "setText", before: "", after: "Dear Ada," }],
      })
      expect((await head(page.doc)).revision).toBe(page.revision)
      expect(await words(page.doc)).toEqual([""])
      const receipt = await approve(proposed.pendingActionId)
      expect(JSON.stringify(receipt)).toContain("paper.undoWord")
      expect(await words(page.doc)).toEqual(["Dear Ada,"])
      await registry.undo(owner, receipt.id)
      const restored = await head(page.doc)
      expect(restored.revision).toBe(page.revision)
      expect(restored.paragraphs.map((line) => line.text)).toEqual([""])
    }))

  it("inserts a paragraph after a handle", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await imported(paragraph("Dear Ada,"))
      const first = page.paragraphs[0]
      if (!first) throw new Error("missing line")
      const proposed = await propose(await coach(), page, [
        { op: "insert", after: first.handle, text: "I led the migration." },
      ])
      expect(proposed.review).toMatchObject({
        operations: [
          {
            op: "insert",
            before: "",
            after: "I led the migration.",
            place: "Dear Ada,",
          },
        ],
      })
      await approve(proposed.pendingActionId)
      const after = await head(page.doc)
      expect(after.paragraphs.map((line) => line.text)).toEqual([
        "Dear Ada,",
        "I led the migration.",
      ])
      expect(after.paragraphs[0]?.handle).toBe(first.handle)
    }))

  it("proposes, approves and undoes a batch with several operations", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await imported(
        paragraph("Dear Ada,") + paragraph("Old line") + paragraph("Thanks")
      )
      const [greeting, old, thanks] = page.paragraphs
      if (!greeting || !old || !thanks) throw new Error("missing lines")
      const proposed = await propose(await coach(), page, [
        { op: "setText", handle: greeting.handle, text: "Dear Grace," },
        {
          op: "insert",
          after: greeting.handle,
          text: "I write about the role.",
        },
        { op: "insert", after: null, text: "12 November 2026" },
        { op: "delete", handle: old.handle },
      ])
      expect(proposed.review).toMatchObject({
        operations: [
          { op: "setText", before: "Dear Ada,", after: "Dear Grace," },
          {
            op: "insert",
            before: "",
            after: "I write about the role.",
            place: "Dear Ada,",
          },
          {
            op: "insert",
            before: "",
            after: "12 November 2026",
            place: null,
          },
          { op: "delete", before: "Old line", after: "" },
        ],
      })
      expect((await head(page.doc)).revision).toBe(page.revision)
      const receipt = await approve(proposed.pendingActionId)
      expect(await words(page.doc)).toEqual([
        "12 November 2026",
        "Dear Grace,",
        "I write about the role.",
        "Thanks",
      ])
      await registry.undo(owner, receipt.id)
      expect(await words(page.doc)).toEqual(["Dear Ada,", "Old line", "Thanks"])
      expect((await head(page.doc)).revision).toBe(page.revision)
    }))

  it("refuses Undo after the person typed on the page and keeps their words", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await blank()
      const empty = page.paragraphs[0]
      if (!empty) throw new Error("blank page has no line")
      const proposed = await propose(await coach(), page, [
        { op: "setText", handle: empty.handle, text: "Dear Ada," },
      ])
      const receipt = await approve(proposed.pendingActionId)
      const approved = await head(page.doc)
      const typed = await apply(owner, {
        doc: page.doc,
        basedOn: approved.revision,
        ops: [
          { op: "setText", handle: empty.handle, text: "Dear Ada Lovelace," },
        ],
      })
      if (typed.refused) throw new Error(typed.message)
      const undone = await registry
        .undo(owner, receipt.id)
        .then((value) => JSON.stringify(value))
        .catch((error: unknown) => String(error))
      expect(undone).toMatch(/changed/)
      expect(await words(page.doc)).toEqual(["Dear Ada Lovelace,"])
      expect((await head(page.doc)).revision).toBe(typed.page.revision)
    }))

  it("refuses Undo of an insert after the person typed on the page and keeps their words", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await imported(paragraph("Dear Ada,"))
      const first = page.paragraphs[0]
      if (!first) throw new Error("missing line")
      const proposed = await propose(await coach(), page, [
        { op: "insert", after: first.handle, text: "I led the migration." },
      ])
      const receipt = await approve(proposed.pendingActionId)
      const approved = await head(page.doc)
      const typed = await apply(owner, {
        doc: page.doc,
        basedOn: approved.revision,
        ops: [
          { op: "setText", handle: first.handle, text: "Dear Ada Lovelace," },
        ],
      })
      if (typed.refused) throw new Error(typed.message)
      const undone = await registry
        .undo(owner, receipt.id)
        .then((value) => JSON.stringify(value))
        .catch((error: unknown) => String(error))
      expect(undone).toMatch(/changed/)
      expect(await words(page.doc)).toEqual([
        "Dear Ada Lovelace,",
        "I led the migration.",
      ])
      expect((await head(page.doc)).revision).toBe(typed.page.revision)
    }))

  it("refuses Undo of a delete after the person typed on the page and keeps their words", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await imported(paragraph("Dear Ada,") + paragraph("Thanks"))
      const [greeting, thanks] = page.paragraphs
      if (!greeting || !thanks) throw new Error("missing lines")
      const proposed = await propose(await coach(), page, [
        { op: "delete", handle: thanks.handle },
      ])
      const receipt = await approve(proposed.pendingActionId)
      const approved = await head(page.doc)
      const typed = await apply(owner, {
        doc: page.doc,
        basedOn: approved.revision,
        ops: [{ op: "setText", handle: greeting.handle, text: "Dear Grace," }],
      })
      if (typed.refused) throw new Error(typed.message)
      const undone = await registry
        .undo(owner, receipt.id)
        .then((value) => JSON.stringify(value))
        .catch((error: unknown) => String(error))
      expect(undone).toMatch(/changed/)
      expect(await words(page.doc)).toEqual(["Dear Grace,"])
      expect((await head(page.doc)).revision).toBe(typed.page.revision)
    }))

  it("keeps an own agent's batch pending and never commits it without approval", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      vi.stubEnv("PAPER_AGENT_TOOLS", "true")
      const page = await blank()
      const empty = page.paragraphs[0]
      if (!empty) throw new Error("blank page has no line")
      const edits = [
        { op: "setText", handle: empty.handle, text: "Dear Ada," },
        { op: "insert", after: empty.handle, text: "Thank you for your time." },
      ]
      const proposed = await propose(delegate(), page, edits)
      expect(proposed.activityId).toBeNull()
      const again = await propose(delegate(), page, edits)
      expect(again.activityId).toBeNull()
      expect(again.pendingActionId).not.toBe(proposed.pendingActionId)
      expect(await words(page.doc)).toEqual([""])
      await expect(approve(proposed.pendingActionId)).rejects.toThrow(
        /no longer active/
      )
      expect((await head(page.doc)).revision).toBe(page.revision)
    }))

  it("refuses a batch based on an older revision", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await blank()
      const empty = page.paragraphs[0]
      if (!empty) throw new Error("blank page has no line")
      const typed = await apply(owner, {
        doc: page.doc,
        basedOn: page.revision,
        ops: [{ op: "setText", handle: empty.handle, text: "Typed" }],
      })
      if (typed.refused) throw new Error(typed.message)
      await expect(
        propose(await coach(), page, [
          { op: "insert", after: empty.handle, text: "Coach words" },
        ])
      ).rejects.toThrow(/changed/)
      expect(await words(page.doc)).toEqual(["Typed"])
    }))

  it("holds a batch that would flatten formatting", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await imported(
        `<w:p>${wordRun("Led ")}${wordRun("data", "<w:b/>")}</w:p>`
      )
      const line = page.paragraphs[0]
      if (!line) throw new Error("missing line")
      await expect(
        propose(await coach(), page, [
          { op: "setText", handle: line.handle, text: "Wrote reports" },
        ])
      ).rejects.toThrow(/mixes formatting/)
      expect((await head(page.doc)).revision).toBe(page.revision)
      expect(await words(page.doc)).toEqual(["Led data"])
    }))

  it("keeps Word operations off the numeric block arm", () =>
    run(async () => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const page = await blank()
      const empty = page.paragraphs[0]
      if (!empty) throw new Error("blank page has no line")
      await expect(
        registry.execute({
          name: "paper.edit",
          input: {
            docId: page.doc,
            basedOn: 1,
            edits: [{ op: "setText", handle: empty.handle, text: "Hi" }],
          },
          actor: await coach(),
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow(/does not match the saved document/)
      await expect(
        registry.execute({
          name: "paper.edit",
          input: {
            docId: page.doc,
            basedOn: page.revision,
            edits: [{ op: "setText", blockId: "letter-1", text: "Hi" }],
          },
          actor: await coach(),
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow(/does not match the saved document/)
      expect(await words(page.doc)).toEqual([""])
    }))
})
