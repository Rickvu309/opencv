import {
  NATIVE_WRITER,
  type NativeBasis,
  coachActor,
  nativePaperDocumentSchema,
  paperViewSchema,
  parsePaperId,
  parseUserId,
} from "@workspace/domain"
import {
  loadYDoc,
  materialize,
  META,
  stateVectorOf,
  updateSince,
  writeDocument,
} from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, transaction, withDatabase } from "../db/context.js"
import { activity, paperDocs, paperDocUpdates, user } from "../db/schema.js"
import { createProposal } from "../registry/proposals.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { openStore } from "../test/paper-content.js"
import { editAsCoach } from "./content-coach.js"
import { seedColumns } from "./content-document.js"
import { admitBasis, admitDocument, basisOf } from "./native-admission.js"
import { syncContent, withContent } from "./content-store.js"

const owner = parseUserId("native-b-admission")
let store: Awaited<ReturnType<typeof openStore>>
beforeAll(async () => {
  store = await openStore(owner)
})
afterAll(async () => {
  await store.client.close()
})
const inDatabase = <T>(run: () => Promise<T>) => withDatabase(store.db, run)
const run = (name: string, input: unknown) =>
  store.registry.execute({ name, input, actor: store.actor })
const native = (text = "Việt 😀 team") =>
  nativePaperDocumentSchema.parse({
    version: 4,
    schemaRevision: 1,
    kind: "letter",
    clashes: [],
    blocks: [
      { id: "p1", type: "paragraph", content: [{ text, underline: true }] },
    ],
  })
const legacy = {
  version: 3,
  kind: "letter",
  clashes: [],
  blocks: [{ id: "p1", type: "paragraph", content: "Dear team" }],
}
async function seeded() {
  const view = paperViewSchema.parse(
    (await run("paper.create", { kind: "letter", document: legacy })).output
  )
  await getDb()
    .update(paperDocs)
    .set(seedColumns("letter", native()))
    .where(eq(paperDocs.id, view.id))
  return view.id
}
async function rowOf(docId: string) {
  const [row] = await getDb()
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  if (!row) throw new Error("Missing Paper")
  return row
}
async function snapshot(docId: string) {
  return {
    row: await rowOf(docId),
    log: await getDb()
      .select()
      .from(paperDocUpdates)
      .where(eq(paperDocUpdates.paperId, docId)),
  }
}
const read = async (docId: string) =>
  paperViewSchema.parse(
    await store.registry.read(
      "paper.get",
      { docId, writer: NATIVE_WRITER },
      store.actor
    )
  )
const qualified = { writer: NATIVE_WRITER }
const coach = coachActor(
  owner,
  "01990b00-0000-7000-8000-000000000001",
  "native-b-turn"
)

function delta(base: Uint8Array, text: string) {
  const doc = loadYDoc(base, [])
  const update = writeDocument(doc, native(text), "person")
  if (!update) throw new Error("Missing update")
  return update
}

describe("native B locked canonical admission", () => {
  it("binds provenance, epoch, revision and canonical digest and refuses a native basis on legacy", () => {
    const doc = native()
    const basis = basisOf(doc, 2, 4)!
    expect(() => admitDocument(doc, NATIVE_WRITER)).not.toThrow()
    expect(() => admitDocument(doc)).toThrow()
    expect(() =>
      admitDocument(doc, { ...NATIVE_WRITER, capabilities: [] })
    ).toThrow()
    expect(() => admitBasis(doc, 2, 4, basis)).not.toThrow()
    const refused: (NativeBasis | undefined)[] = [
      undefined,
      { ...basis, epoch: 1 },
      { ...basis, revision: 3 },
      { ...basis, digest: "0".repeat(64) },
      {
        ...basis,
        provenance: {
          ...basis.provenance,
          requiredCapabilities: ["underline", "underline"],
        },
      },
    ]
    for (const changed of refused)
      expect(() => admitBasis(doc, 2, 4, changed)).toThrow()
    expect(() =>
      admitBasis(
        { ...legacy, version: 3, kind: "letter", blocks: [], clashes: [] },
        2,
        4,
        basis
      )
    ).toThrow()
  })

  it("refuses unqualified reads, missing writer and old sync before callback or acknowledgement", async () =>
    inDatabase(async () => {
      const docId = await seeded()
      const before = await snapshot(docId)
      await expect(
        store.registry.read("paper.get", { docId }, store.actor)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      for (const epoch of [0, 1, 999])
        await expect(
          syncContent(owner, docId, {
            epoch,
            update: new Uint8Array(),
            stateVector: new Uint8Array(),
          })
        ).rejects.toMatchObject({ code: "CONFLICT" })
      let called = false
      await expect(
        withContent(owner, docId, async () => {
          called = true
        })
      ).rejects.toMatchObject({ code: "CONFLICT" })
      await expect(
        withContent(
          owner,
          docId,
          async () => {
            called = true
          },
          { writer: { ...NATIVE_WRITER, supportedSchemaRevisions: [2] } }
        )
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(called).toBe(false)
      expect(await snapshot(docId)).toEqual(before)
      expect((await read(docId)).paper).toEqual(native())
    }))

  it("refuses missing and stale native proposal basis for a person as well as a Coach", async () =>
    inDatabase(async () => {
      const docId = await seeded()
      const initial = await read(docId)
      const input = {
        writer: NATIVE_WRITER,
        basedOn: initial.contentVersion,
        edits: [
          { op: "setText" as const, blockId: "p1", text: "Dear colleagues" },
        ],
        editId: "native-proposal",
        newId: () => "fresh",
      }
      const before = await snapshot(docId)
      await expect(
        editAsCoach(owner, docId, input, store.actor)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await snapshot(docId)).toEqual(before)
      await withContent(
        owner,
        docId,
        async (content) => {
          await content.edit({
            origin: "person",
            target: native("Person changed"),
          })
        },
        qualified
      )
      const changed = await snapshot(docId)
      await expect(
        editAsCoach(
          owner,
          docId,
          { ...input, nativeBasis: initial.nativeBasis },
          store.actor
        )
      ).rejects.toMatchObject({ code: "CONFLICT" })
      await expect(
        editAsCoach(
          owner,
          docId,
          { ...input, nativeBasis: initial.nativeBasis },
          coach
        )
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await snapshot(docId)).toEqual(changed)
      const current = await read(docId)
      const result = await editAsCoach(
        owner,
        docId,
        {
          ...input,
          basedOn: current.contentVersion,
          nativeBasis: current.nativeBasis,
        },
        store.actor
      )
      expect(result.editId).toBe(input.editId)
      expect((await read(docId)).paper.version).toBe(4)
    }))

  it("holds a native Coach proposal and refuses stale approval without changing canonical content", async () =>
    inDatabase(async () => {
      await getDb()
        .update(user)
        .set({ agentCvs: true })
        .where(eq(user.id, owner))
      const chat = await run("chat.create", {})
      const actor = await seedCoachActor(
        owner,
        (chat.output as { id: string }).id
      )
      const docId = await seeded()
      const initial = await read(docId)
      const before = await snapshot(docId)
      const proposal = await createProposal({
        command: "paper.edit",
        input: {
          docId,
          writer: NATIVE_WRITER,
          nativeBasis: initial.nativeBasis,
          basedOn: initial.contentVersion,
          edits: [{ op: "setText", blockId: "p1", text: "Coach proposal" }],
        },
        actor,
        summary: "Coach edit",
        basisRevision: null,
      })
      expect(proposal.pending).toBe(true)
      expect(await snapshot(docId)).toEqual(before)
      await withContent(
        owner,
        docId,
        async (content) => {
          await content.edit({
            origin: "person",
            target: native("Person continued"),
          })
        },
        qualified
      )
      const changed = await snapshot(docId)
      await expect(
        store.registry.approve(owner, proposal.pendingActionId)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await snapshot(docId)).toEqual(changed)
      expect((await read(docId)).paper).toEqual(native("Person continued"))
    }))

  it("refuses raw cross-schema append before any database write, then accepts two edits under the same lock", async () =>
    inDatabase(async () => {
      const docId = await seeded()
      const before = await snapshot(docId)
      const base = before.row.crdtBase!
      const invalid = loadYDoc(base, [])
      const vector = stateVectorOf(invalid)
      writeDocument(invalid, native("Lost schema"), "person")
      invalid.getMap<string>(META).set("version", "3")
      invalid.getMap<string>(META).delete("schemaRevision")
      const raw = updateSince(invalid, vector)
      if (!raw) throw new Error("Missing raw update")
      await withContent(
        owner,
        docId,
        async (content) => {
          await expect(
            content.append({ origin: "coach", editId: "refused", update: raw })
          ).rejects.toThrow(/schema/)
          expect(await snapshot(docId)).toEqual(before)
          await content.append({
            origin: "coach",
            editId: "accepted",
            update: delta(base, "Accepted 😀"),
          })
          await content.edit({
            origin: "person",
            target: native("Consecutive 😃"),
          })
        },
        qualified
      )
      const after = await snapshot(docId)
      expect(after.row.contentVersion).toBe(before.row.contentVersion + 2)
      expect(after.row.crdtDocument).toEqual(native("Consecutive 😃"))
      await withContent(
        owner,
        docId,
        async (content) => {
          expect(content.document).toEqual(native("Consecutive 😃"))
        },
        qualified
      )
    }))

  it("never publishes a native candidate from an outer rollback", async () =>
    inDatabase(async () => {
      const docId = await seeded()
      await withContent(owner, docId, async () => {}, qualified)
      const before = await snapshot(docId)
      await expect(
        transaction(async () => {
          await withContent(
            owner,
            docId,
            async (content) => {
              await content.edit({
                origin: "person",
                target: native("Rolled back"),
              })
            },
            qualified
          )
          throw new Error("outer rollback")
        })
      ).rejects.toThrow("outer rollback")
      expect(await snapshot(docId)).toEqual(before)
      await withContent(
        owner,
        docId,
        async (content) => {
          expect(content.document).toEqual(native())
          const fork = await content.fork(content.row.contentVersion)
          expect(materialize(fork)).toEqual({ ok: true, document: native() })
        },
        qualified
      )
    }))

  it("keeps public creation legacy-only and qualified metadata copies native marks", async () =>
    inDatabase(async () => {
      await expect(
        run("paper.create", { kind: "letter", document: native() })
      ).rejects.toThrow()
      const docId = await seeded()
      const before = await snapshot(docId)
      for (const [name, input] of [
        ["paper.rename", { name: "Renamed" }],
        ["paper.setStatus", { status: "ready" }],
        ["paper.duplicate", {}],
      ] as const)
        await expect(run(name, { docId, ...input })).rejects.toMatchObject({
          code: "CONFLICT",
        })
      expect(await snapshot(docId)).toEqual(before)
      await run("paper.rename", {
        docId,
        name: "Renamed",
        writer: NATIVE_WRITER,
      })
      await run("paper.setStatus", {
        docId,
        status: "ready",
        writer: NATIVE_WRITER,
      })
      const copy = paperViewSchema.parse(
        (await run("paper.duplicate", { docId, writer: NATIVE_WRITER })).output
      )
      expect(copy.paper).toEqual(native())
      expect((await read(docId)).paper).toEqual(native())
      expect((await rowOf(docId)).crdtBase).toEqual(before.row.crdtBase)
      expect((await snapshot(docId)).log).toEqual(before.log)
      await expect(run("paper.share", { docId })).rejects.toMatchObject({
        code: "CONFLICT",
      })
      const shared = await run("paper.share", { docId, writer: NATIVE_WRITER })
      expect(shared.output).toMatchObject({ docId, token: expect.any(String) })
      await run("paper.unshare", { docId, writer: NATIVE_WRITER })
      expect((await read(docId)).paper).toEqual(native())
    }))

  it("stores the qualified writer in the numeric edit reversal and Undo preserves schema", async () =>
    inDatabase(async () => {
      const docId = await seeded()
      const before = await read(docId)
      const result = await run("paper.edit", {
        docId,
        writer: NATIVE_WRITER,
        nativeBasis: before.nativeBasis,
        basedOn: before.contentVersion,
        edits: [{ op: "setText", blockId: "p1", text: "Dear colleagues" }],
      })
      const [receipt] = await getDb()
        .select()
        .from(activity)
        .where(eq(activity.id, result.activityId!))
      expect(receipt?.reversalCommand).toBe("paper.revertEdit")
      expect(receipt?.reversalInput).toMatchObject({
        docId,
        writer: NATIVE_WRITER,
      })
      await store.registry.undo(owner, receipt!.id)
      expect((await read(docId)).paper).toEqual(before.paper)
    }))

  it("keeps a legacy document legacy after ordinary sync", async () =>
    inDatabase(async () => {
      const view = paperViewSchema.parse(
        (await run("paper.create", { kind: "letter", document: legacy })).output
      )
      await syncContent(owner, parsePaperId(view.id), {
        epoch: 0,
        update: new Uint8Array(),
        stateVector: new Uint8Array(),
      })
      expect((await rowOf(view.id)).crdtDocument).toEqual(view.paper)
    }))
})
