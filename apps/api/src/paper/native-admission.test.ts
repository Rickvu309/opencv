import {
  NATIVE_WRITER,
  nativePaperDocumentSchema,
  nativeProvenance,
  nativeSyncOutputSchema,
  paperDocumentSchema,
  paperViewSchema,
  paperContract,
} from "@workspace/domain"
import {
  loadYDoc,
  materialize,
  stateVectorOf,
  updateSince,
  writeDocument,
} from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { resolveTurnGrounding } from "../coach/context.js"
import { fakePaperEdit } from "../coach/fake.js"
import { activity, paperDocs, paperDocUpdates, user } from "../db/schema.js"
import { createProposal } from "../registry/proposals.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { bytesOf, encoded, openStore } from "../test/paper-content.js"

const userId = "native-underline-admission"
let store: Awaited<ReturnType<typeof openStore>>
beforeAll(async () => {
  store = await openStore(userId)
})
afterAll(async () => {
  await store.client.close()
})
const inDatabase = <T>(run: () => Promise<T>) => withDatabase(store.db, run)
const run = (name: string, input: unknown) =>
  store.registry.execute({ name, input, actor: store.actor })
const query = (name: string, input: unknown) =>
  store.registry.read(name, input, store.actor)

async function rowOf(docId: string) {
  const [row] = await store.db
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  if (!row) throw new Error("Missing paper")
  return row
}

async function snapshot(docId: string) {
  const row = await rowOf(docId)
  return {
    epoch: row.crdtEpoch,
    revision: row.contentVersion,
    baseSeq: row.crdtBaseSeq,
    base: row.crdtBase,
    paper: row.crdtDocument,
    updates: await store.db
      .select()
      .from(paperDocUpdates)
      .where(eq(paperDocUpdates.paperId, docId)),
  }
}

async function created() {
  const document = paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks: [{ id: "p1", type: "paragraph", content: "Việt 😀 dear team" }],
    clashes: [],
  })
  const result = paperViewSchema.parse(
    (
      await run("paper.create", {
        name: "Native Letter",
        kind: "letter",
        document,
      })
    ).output
  )
  return result.id
}

async function upgrade(docId: string) {
  const row = await rowOf(docId)
  return paperViewSchema.parse(
    (
      await run("paper.migrateNative", {
        docId,
        writer: NATIVE_WRITER,
        epoch: row.crdtEpoch ?? 1,
        basedOn: row.contentVersion,
      })
    ).output
  )
}

const read = async (docId: string) =>
  paperViewSchema.parse(
    await query("paper.get", { docId, writer: NATIVE_WRITER })
  )

async function pull(docId: string) {
  const view = await read(docId)
  if (view.paper.version !== 4) throw new Error("Not native")
  const provenance = nativeProvenance(view.paper)
  return nativeSyncOutputSchema.parse(
    (
      await run("paper.nativeSync", {
        docId,
        writer: NATIVE_WRITER,
        provenance,
        epoch: 0,
        update: "",
        stateVector: "",
      })
    ).output
  )
}

async function person(docId: string, text: string) {
  const before = await pull(docId)
  const doc = loadYDoc(bytesOf(before.update), [])
  const current = materialize(doc)
  if (!current.ok) throw new Error(current.reason)
  const target = nativePaperDocumentSchema.parse({
    ...current.document,
    blocks: [
      {
        id: "p1",
        type: "paragraph",
        content: [{ text, bold: true, underline: true }],
      },
    ],
  })
  const update = writeDocument(doc, target, "person")
  await run("paper.nativeSync", {
    docId,
    writer: NATIVE_WRITER,
    provenance: before.provenance,
    epoch: before.epoch,
    basedOn: before.revision,
    update: encoded(update),
    stateVector: "",
  })
}

async function coach() {
  await store.db.update(user).set({ agentCvs: true }).where(eq(user.id, userId))
  const chat = await run("chat.create", {})
  const { id } = chat.output as { id: string }
  return seedCoachActor(userId, id)
}

const words = [
  { op: "setText", blockId: "p1", text: "Việt 😀 dear colleagues" },
]

describe("native admission before hydration or acknowledgement", () => {
  it("refuses CV migration at the command boundary without changing its checkpoint", async () =>
    inDatabase(async () => {
      const made = await run("paper.create", { kind: "cv" })
      const view = paperViewSchema.parse(made.output)
      const before = await snapshot(view.id)
      await expect(
        run("paper.migrateNative", {
          docId: view.id,
          writer: NATIVE_WRITER,
          epoch: before.epoch ?? 1,
          basedOn: before.revision,
        })
      ).rejects.toThrow(/Only an existing Letter/)
      expect(await snapshot(view.id)).toEqual(before)
    }))

  it("upgrades under a locked monotonic checkpoint and refuses a stale upgrade", async () =>
    inDatabase(async () => {
      const docId = await created()
      const before = await snapshot(docId)
      const upgraded = await upgrade(docId)
      const after = await snapshot(docId)
      expect(upgraded.paper.version).toBe(4)
      expect(after.epoch).toBe((before.epoch ?? 1) + 1)
      expect(after.revision).toBe(before.revision + 1)
      expect(after.baseSeq).toBe(after.revision)
      expect(after.updates).toEqual(before.updates)
      await expect(
        run("paper.migrateNative", {
          docId,
          writer: NATIVE_WRITER,
          epoch: before.epoch ?? 1,
          basedOn: before.revision,
        })
      ).rejects.toBeDefined()
      expect(await snapshot(docId)).toEqual(after)
    }))

  it("refuses old readers and writers at matching, old and zero epochs without exposing native bytes", async () =>
    inDatabase(async () => {
      const docId = await created()
      await upgrade(docId)
      const before = await snapshot(docId)
      for (const epoch of [0, 1, before.epoch]) {
        await expect(
          run("paper.sync", { docId, epoch, update: "", stateVector: "" })
        ).rejects.toMatchObject({ code: "CONFLICT" })
        expect(await snapshot(docId)).toEqual(before)
      }
      for (const name of ["paper.get", "paper.outline", "paper.pageCount"]) {
        await expect(query(name, { docId })).rejects.toMatchObject({
          code: "CONFLICT",
        })
      }
      await expect(query("paper.list", {})).rejects.toMatchObject({
        code: "CONFLICT",
      })
      await expect(
        run("paper.rename", { docId, name: "Old writer" })
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await snapshot(docId)).toEqual(before)
      expect((await read(docId)).nativeBasis?.epoch).toBe(before.epoch)
    }))

  it("rejects missing capabilities, unbased bytes and invalid candidates without changing the live cache", async () =>
    inDatabase(async () => {
      const docId = await created()
      await upgrade(docId)
      await person(docId, "Việt 😀 underlined")
      const pulled = await pull(docId)
      const before = await snapshot(docId)
      const base = {
        docId,
        writer: NATIVE_WRITER,
        provenance: pulled.provenance,
        epoch: pulled.epoch,
        update: "",
        stateVector: "",
      }
      await expect(
        run("paper.nativeSync", {
          ...base,
          writer: { ...NATIVE_WRITER, capabilities: ["structured-prose"] },
        })
      ).rejects.toMatchObject({ code: "CONFLICT" })
      await expect(
        run("paper.nativeSync", {
          ...base,
          epoch: 0,
          basedOn: pulled.revision,
          update: pulled.update,
        })
      ).rejects.toBeDefined()
      const invalid = loadYDoc(bytesOf(pulled.update), [])
      const vector = stateVectorOf(invalid)
      invalid.getMap<string>("paper").set("schemaRevision", "2")
      await expect(
        run("paper.nativeSync", {
          ...base,
          basedOn: pulled.revision,
          update: encoded(updateSince(invalid, vector)),
        })
      ).rejects.toBeDefined()
      expect(await snapshot(docId)).toEqual(before)
      const verified = await pull(docId)
      const materialized = materialize(bytesOf(verified.update))
      expect(materialized.ok && materialized.document).toEqual(
        (await read(docId)).paper
      )
    }))

  it("retains old pending proposals and safely refuses historical Undo after migration", async () =>
    inDatabase(async () => {
      const docId = await created()
      const before = await rowOf(docId)
      const edited = await run("paper.edit", {
        docId,
        basedOn: before.contentVersion,
        edits: words,
      })
      const old = edited.output as { editId: string }
      const actor = await coach()
      const proposal = await createProposal({
        command: "paper.edit",
        input: {
          docId,
          basedOn: (await rowOf(docId)).contentVersion,
          edits: words,
        },
        actor,
        summary: "Old proposal",
        basisRevision: null,
      })
      await upgrade(docId)
      const upgraded = await snapshot(docId)
      await expect(
        store.registry.approve(userId, proposal.pendingActionId)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      await expect(
        run("paper.revertEdit", {
          docId,
          editId: old.editId,
          writer: NATIVE_WRITER,
        })
      ).rejects.toBeDefined()
      expect(await snapshot(docId)).toEqual(upgraded)
    }))
})

describe("native Letter metadata actions", () => {
  it("renames, copies and changes status without flattening native marks", async () =>
    inDatabase(async () => {
      const docId = await created()
      await upgrade(docId)
      await person(docId, "Việt 😀 marked Letter")
      const before = (await read(docId)).paper
      for (const [name, input] of [
        ["paper.rename", { docId, name: "Refused" }],
        ["paper.duplicate", { docId }],
        ["paper.setStatus", { docId, status: "ready" }],
      ] as const) {
        await expect(run(name, input)).rejects.toMatchObject({
          code: "CONFLICT",
        })
      }
      const renamed = paperContract["paper.rename"].output.parse(
        (
          await run("paper.rename", {
            docId,
            name: "Marked Letter",
            writer: NATIVE_WRITER,
          })
        ).output
      )
      expect(renamed.name).toBe("Marked Letter")
      expect(renamed.paper).toEqual(before)
      const ready = paperViewSchema.parse(
        (
          await run("paper.setStatus", {
            docId,
            status: "ready",
            writer: NATIVE_WRITER,
          })
        ).output
      )
      expect(ready.status).toBe("ready")
      expect(ready.paper).toEqual(before)
      const copy = paperViewSchema.parse(
        (await run("paper.duplicate", { docId, writer: NATIVE_WRITER })).output
      )
      expect(copy.id).not.toBe(docId)
      expect(copy.paper).toEqual(before)
      expect((await read(copy.id)).paper).toEqual(before)
    }))
})

describe("approved native Coach editing", () => {
  it("binds schema and digest, commits once, retains underline and selectively undoes around later typing", async () =>
    inDatabase(async () => {
      const docId = await created()
      await upgrade(docId)
      await person(docId, "Việt 😀 dear team")
      const actor = await coach()
      const view = await read(docId)
      const input = {
        docId,
        basedOn: view.contentVersion,
        writer: NATIVE_WRITER,
        nativeBasis: view.nativeBasis,
        edits: words,
      }
      const grounding = await resolveTurnGrounding({
        registry: store.registry,
        actor: store.actor,
        requestFocusDocId: docId,
        storedKind: null,
        storedId: null,
        memoryEnabled: false,
      })
      if (!grounding.focusDoc) throw new Error("Missing native focus")
      expect(fakePaperEdit(grounding.focusDoc)).toMatchObject({
        writer: NATIVE_WRITER,
        nativeBasis: view.nativeBasis,
      })
      const before = await snapshot(docId)
      const proposal = await createProposal({
        command: "paper.edit",
        input,
        actor,
        summary: "Native wording",
        basisRevision: null,
      })
      expect(await snapshot(docId)).toEqual(before)
      const first = await store.registry.approve(
        userId,
        proposal.pendingActionId
      )
      if (!first) throw new Error("No approval receipt")
      const committed = await snapshot(docId)
      const retry = await store.registry.approve(
        userId,
        proposal.pendingActionId
      )
      expect(retry?.id).toBe(first.id)
      expect(await snapshot(docId)).toEqual(committed)
      const paragraph = (await read(docId)).paper.blocks[0]!
      expect("content" in paragraph && paragraph.content).toEqual([
        { text: "Việt 😀 dear colleagues", underline: true },
      ])
      const receipts = await store.db
        .select()
        .from(activity)
        .where(eq(activity.id, first.id))
      expect(receipts).toHaveLength(1)
      await person(docId, "Việt 😀 dear colleagues + later")
      await store.registry.undo(userId, first.id)
      const restored = (await read(docId)).paper.blocks[0]!
      expect(
        "content" in restored &&
          restored.content.map((run) => run.text).join("")
      ).toBe("Việt 😀 dear team + later")
      expect(
        "content" in restored && restored.content.some((run) => run.underline)
      ).toBe(true)
      await expect(
        store.registry.execute({
          name: "activity.undo",
          input: { activityId: first.id },
          actor,
        })
      ).rejects.toMatchObject({ code: "COACH_NOT_ALLOWED" })
    }))

  it("refuses a proposal whose exact native digest or revision changed", async () =>
    inDatabase(async () => {
      const docId = await created()
      await upgrade(docId)
      const actor = await coach()
      const view = await read(docId)
      const proposal = await createProposal({
        command: "paper.edit",
        input: {
          docId,
          basedOn: view.contentVersion,
          writer: NATIVE_WRITER,
          nativeBasis: view.nativeBasis,
          edits: words,
        },
        actor,
        summary: "Native wording",
        basisRevision: null,
      })
      await person(docId, "Việt 😀 person changed")
      const before = await snapshot(docId)
      await expect(
        store.registry.approve(userId, proposal.pendingActionId)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await snapshot(docId)).toEqual(before)
    }))
})
