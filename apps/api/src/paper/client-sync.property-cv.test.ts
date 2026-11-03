import fc from "fast-check"
import { afterAll, beforeAll, describe, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { play, useCoachStore, verdict } from "../test/cv-sync-play.js"

let h: CoachStore

const nightly = process.env.GITHUB_WORKFLOW === "Full run on main"
const RUNS = Number(process.env.PAPER_SYNC_RUNS ?? (nightly ? 40 : 4))
const STEPS = Number(process.env.PAPER_SYNC_STEPS ?? (nightly ? 16 : 12))

const step = fc.record({
  kind: fc.constantFrom(
    "type",
    "type",
    "erase",
    "header",
    "field",
    "title",
    "skillAdd",
    "skillDrop",
    "skillSplit",
    "move",
    "split",
    "join",
    "addSection",
    "dropSection",
    "sync",
    "launch",
    "deliver",
    "coachField",
    "coachHeader",
    "coachInto",
    "coachSet",
    "coachSet",
    "coachMove",
    "coachRemove"
  ),
  tab: fc.nat(1),
  a: fc.nat(1000),
  b: fc.nat(1000),
})

describe("CV client sync keeps fields and person words", () => {
  beforeAll(async () => {
    h = await openCoachStore("user-cv-sync")
    useCoachStore(h)
  })

  afterAll(async () => {
    await h.store.client.close()
  })

  it(
    "no blend and no lost word (one tab)",
    () =>
      h.inDatabase(async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(step, { minLength: 4, maxLength: STEPS }),
            async (steps) => {
              verdict(await play(steps, false))
            }
          ),
          {
            numRuns: RUNS,
            ...(process.env.PAPER_SYNC_SEED
              ? {
                  seed: Number(process.env.PAPER_SYNC_SEED),
                  path: process.env.PAPER_SYNC_PATH,
                }
              : {}),
          }
        )
      }),
    Number(process.env.PAPER_SYNC_TIMEOUT ?? (nightly ? 120_000 : 15_000))
  )

  it("keeps a typed word through a Coach insert, a field edit and a sync", () =>
    h.inDatabase(async () => {
      verdict(
        await play(
          [
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "coachInto", tab: 0, a: 0, b: 0 },
            { kind: "coachField", tab: 0, a: 0, b: 0 },
            { kind: "sync", tab: 0, a: 0, b: 0 },
            { kind: "coachSet", tab: 0, a: 0, b: 0 },
            { kind: "launch", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 1, b: 0 },
            { kind: "deliver", tab: 0, a: 0, b: 0 },
          ],
          false
        )
      )
    }))
})
