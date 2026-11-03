import { openPaperClient, stateVectorOf } from "@workspace/paper-crdt"
import { parseUserId } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { encoded, typed, withText } from "../test/paper-content.js"
import { openTab } from "../test/paper-client.js"
import { bytesOf } from "../test/paper-content.js"
import { syncContent } from "./content-store.js"

let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore("user-sync-guard")
})

afterAll(async () => {
  await h.store.client.close()
})

describe("a guarded paper.sync push", () => {
  it("absorbs at the current revision and answers stale above it without writing", () =>
    h.inDatabase(async () => {
      const { docId, client } = await h.created()
      const current = await h.paperOf(docId)
      const before = await h.rowCount(docId)
      const update = typed(client, (paper) => withText(paper, "t1", "Guarded"))
      const moved = await h.coach(docId, 1, [
        { op: "setText", blockId: "t2", text: "Coach moved the revision" },
      ])
      expect(moved.output.revision).toBeGreaterThan(1)
      expect(current).toBeTruthy()

      const stale = await h.run("paper.sync", {
        docId,
        epoch: 1,
        update,
        stateVector: encoded(stateVectorOf(client)),
        basedOn: 1,
      })
      expect(stale.output).toMatchObject({ stale: true, reset: false })
      expect(await h.rowCount(docId)).toBe(before + 1)
      expect(await h.textOf(docId, "t1")).not.toBe("Guarded")
      expect(
        (stale.output as { update: string }).update.length
      ).toBeGreaterThan(0)

      const absorbed = await h.run("paper.sync", {
        docId,
        epoch: 1,
        update,
        stateVector: encoded(stateVectorOf(client)),
        basedOn: moved.output.revision,
      })
      expect(absorbed.output).toMatchObject({ stale: false })
      expect(await h.textOf(docId, "t1")).toBe("Guarded")
      expect(await h.rowCount(docId)).toBe(before + 2)
    }))

  it("answers a retried push with the bytes the server already absorbed", () =>
    h.inDatabase(async () => {
      const { docId } = await h.created()
      const tab = openTab(h, docId)
      await tab.round()
      tab.edit((paper) => withText(paper, "t1", "Absorbed once"))
      await tab.launch()
      const rows = await h.rowCount(docId)
      expect(rows).toBeGreaterThan(0)

      await tab.launch()
      expect(await h.rowCount(docId)).toBe(rows)
      const receipt = tab.deliver()
      expect(receipt.stale).toBe(true)
      expect(tab.client.hasPending()).toBe(false)
      expect(await h.textOf(docId, "t1")).toBe("Absorbed once")
      await tab.settle(2)
      expect(await h.textOf(docId, "t1")).toBe("Absorbed once")
      expect(await h.rowCount(docId)).toBe(rows)
    }))

  it("never lets the client push content without the revision it is based on", () =>
    h.inDatabase(async () => {
      const { docId } = await h.created()
      const tab = openTab(h, docId)
      await tab.round()
      expect(tab.client.prepare().basedOn).toBeUndefined()
      tab.edit((paper) => withText(paper, "t1", "Guarded by the client"))
      const sent = tab.client.prepare()
      expect(sent.basedOn).toBe(tab.client.revision)
      const reloaded = openPaperClient(tab.client.stored())
      expect(reloaded.prepare().basedOn).toBe(tab.client.revision)
      expect(tab.client.prepare({ pullOnly: true }).basedOn).toBeUndefined()
    }))

  it("refuses a push that carries content and no revision, writing nothing", () =>
    h.inDatabase(async () => {
      const { docId, client } = await h.created()
      const before = await h.rowCount(docId)
      const update = typed(client, (paper) =>
        withText(paper, "t1", "Unguarded")
      )
      await expect(
        syncContent(parseUserId("user-sync-guard"), docId as never, {
          epoch: 1,
          update: bytesOf(update),
          stateVector: new Uint8Array(),
          basedOn: undefined,
        })
      ).rejects.toThrow(/revision/)
      expect(await h.rowCount(docId)).toBe(before)
      expect(await h.textOf(docId, "t1")).not.toBe("Unguarded")
    }))
})
