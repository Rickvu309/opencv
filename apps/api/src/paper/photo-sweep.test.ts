import { describe, expect, it } from "vitest"

import { withDatabase, type AppDatabase } from "../db/context.js"

import { sweepUnattachedPhotos } from "./photo-sweep.js"

const KEPT = "11111111-1111-1111-1111-111111111111"
const REMOVED = "22222222-2222-2222-2222-222222222222"

function referenceError(code: string) {
  const cause = Object.assign(
    new Error('Key (id)=(abc) is referenced from table "photo_refs".'),
    { code }
  )
  return Object.assign(
    new Error("Failed query: delete from opencv_app.files"),
    {
      cause,
    }
  )
}

function dbThatRefusesThenDeletes(code: string) {
  let calls = 0
  return {
    calls: () => calls,
    db: {
      execute: async () => {
        calls += 1
        if (calls === 1) throw referenceError(code)
        return { rows: [{ id: REMOVED }] }
      },
    } as unknown as AppDatabase,
  }
}

describe("sweepUnattachedPhotos", () => {
  it.each(["23001", "23503"])(
    "keeps a file when the delete raises %s",
    async (code) => {
      const harness = dbThatRefusesThenDeletes(code)
      const deleted = await withDatabase(harness.db, () =>
        sweepUnattachedPhotos()
      )
      expect(deleted).toEqual([REMOVED])
      expect(deleted).not.toContain(KEPT)
      expect(harness.calls()).toBe(2)
    }
  )

  it("throws when the delete fails for another reason", async () => {
    const db = {
      execute: async () => {
        throw referenceError("40P01")
      },
    } as unknown as AppDatabase
    await expect(
      withDatabase(db, () => sweepUnattachedPhotos())
    ).rejects.toThrow(/Failed query/)
  })
})
