import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { user, paperDocs, pendingActions } from "../db/schema.js"
import { createProposal } from "../registry/proposals.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { withText } from "../test/paper-content.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { stalePaperBasis } from "./content-coach.js"

const coachWords = [
  { op: "setText" as const, blockId: "t2", text: "Coach words." },
]

async function opened(
  id: string,
  run: (
    store: CoachStore,
    coach: Awaited<ReturnType<typeof seedCoachActor>>
  ) => Promise<void>
) {
  const store = await openCoachStore(id)
  try {
    await store.inDatabase(async () => {
      await store.store.db
        .update(user)
        .set({ agentCvs: true })
        .where(eq(user.id, id))
      const chat = await store.store.registry.execute({
        name: "chat.create",
        input: {},
        actor: store.store.actor,
      })
      const coach = await seedCoachActor(id, (chat.output as { id: string }).id)
      await run(store, coach)
    })
  } finally {
    await store.store.client.close()
  }
}

async function snapshot(store: CoachStore, docId: string) {
  const [row] = await store.store.db
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  if (!row) throw new Error("missing document")
  return {
    revision: row.contentVersion,
    paper: row.crdtDocument,
    rows: await store.rowCount(docId),
  }
}

describe("Coach Paper proposal replay", () => {
  it("keeps the current basis policy on one return", () => {
    expect(stalePaperBasis(1, 2)).toBe("refuse")
    expect(stalePaperBasis(2, 2)).toBe("apply")
  })

  it("holds a Coach edit until the person approves", async () => {
    await opened("s0-proposal", async (store, coach) => {
      const { docId } = await store.created()
      const before = await snapshot(store, docId)
      const result = await store.store.registry.execute({
        name: "paper.edit",
        input: { docId, basedOn: before.revision, edits: coachWords },
        actor: coach,
      })
      expect(result.pending).toBe(true)
      expect(result.pendingActionId).toEqual(expect.any(String))
      expect(await snapshot(store, docId)).toEqual(before)
    })
  })

  it("refuses approval after the person types and leaves the bytes unchanged", async () => {
    await opened("s0-stale", async (store, coach) => {
      const { docId, client } = await store.created()
      const initial = await snapshot(store, docId)
      const proposal = await createProposal({
        command: "paper.edit",
        input: { docId, basedOn: initial.revision, edits: coachWords },
        actor: coach,
        summary: "Coach edit",
      })
      expect(proposal.pending).toBe(true)
      expect(await snapshot(store, docId)).toEqual(initial)
      await store.person(docId, client, (paper) =>
        withText(paper, "t1", "First paragraph. Person words.")
      )
      const before = await snapshot(store, docId)
      expect(before.revision).toBe(initial.revision + 1)
      await expect(
        store.store.registry.approve("s0-stale", proposal.pendingActionId)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await snapshot(store, docId)).toEqual(before)
      expect(await store.textOf(docId, "t1")).toBe(
        "First paragraph. Person words."
      )
      expect(await store.textOf(docId, "t2")).toBe("Second paragraph.")
    })
  })

  it("applies one approval, keeps later typing on Undo, and gives the Coach no Undo", async () => {
    await opened("s0-controls", async (store, coach) => {
      const { docId, client } = await store.created()
      const initial = await snapshot(store, docId)
      const proposal = await createProposal({
        command: "paper.edit",
        input: { docId, basedOn: initial.revision, edits: coachWords },
        actor: coach,
        summary: "Coach edit",
      })
      expect(await snapshot(store, docId)).toEqual(initial)
      const first = await store.store.registry.approve(
        "s0-controls",
        proposal.pendingActionId
      )
      if (!first) throw new Error("approve returned no activity")
      const committed = await snapshot(store, docId)
      expect(committed.revision).toBe(initial.revision + 1)
      expect(await store.textOf(docId, "t2")).toBe("Coach words.")
      const second = await store.store.registry.approve(
        "s0-controls",
        proposal.pendingActionId
      )
      expect(second?.id).toBe(first.id)
      expect(await snapshot(store, docId)).toEqual(committed)
      const [pending] = await store.store.db
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.id, proposal.pendingActionId))
      expect(pending?.status).toBe("approved")
      const names = (await store.store.registry.tools(coach)).map(
        (tool) => tool.name
      )
      expect(names).not.toContain("activity.undo")
      expect(names).not.toContain("paper.revertEdit")
      await expect(
        store.store.registry.execute({
          name: "activity.undo",
          input: { activityId: first.id },
          actor: coach,
        })
      ).rejects.toMatchObject({ code: "COACH_NOT_ALLOWED" })
      expect(await snapshot(store, docId)).toEqual(committed)
      await store.person(docId, client, (paper) =>
        withText(paper, "t1", "First paragraph. Later typing.")
      )
      const beforeUndo = await snapshot(store, docId)
      try {
        await store.store.registry.undo("s0-controls", first.id)
      } catch (error) {
        expect(error).toMatchObject({ code: "CONFLICT" })
        expect(await snapshot(store, docId)).toEqual(beforeUndo)
      }
      expect(await store.textOf(docId, "t1")).toBe(
        "First paragraph. Later typing."
      )
    })
  })
})
