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

describe("CV client sync keeps fields and person words with two tabs", () => {
  beforeAll(async () => {
    h = await openCoachStore("user-cv-sync-two")
    useCoachStore(h)
  })

  afterAll(async () => {
    await h.store.client.close()
  })

  it(
    "no blend and no lost word (two tabs)",
    () =>
      h.inDatabase(async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(step, { minLength: 4, maxLength: STEPS }),
            async (steps) => {
              verdict(await play(steps, true))
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

  it("keeps one whole skill list when one tab drops its add and the other adds", () =>
    h.inDatabase(async () => {
      verdict(
        await play(
          [
            { kind: "skillAdd", tab: 1, a: 0, b: 0 },
            { kind: "sync", tab: 1, a: 0, b: 0 },
            { kind: "skillDrop", tab: 1, a: 895, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "skillAdd", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
          ],
          true
        )
      )
    }))

  it("keeps the person's skill label after the Coach removes that block", () =>
    h.inDatabase(async () => {
      verdict(
        await play(
          [
            { kind: "coachField", tab: 0, a: 717, b: 5 },
            { kind: "coachRemove", tab: 0, a: 1, b: 227 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "skillAdd", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
          ],
          true
        )
      )
    }))

  it("drops a section title the other tab never edited", () =>
    h.inDatabase(async () => {
      verdict(
        await play(
          [
            { kind: "title", tab: 1, a: 385, b: 0 },
            { kind: "dropSection", tab: 1, a: 277, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
          ],
          true
        )
      )
    }))

  it("drops a section title both tabs deleted", () =>
    h.inDatabase(async () => {
      verdict(
        await play(
          [
            { kind: "title", tab: 0, a: 409, b: 0 },
            { kind: "dropSection", tab: 1, a: 943, b: 0 },
            { kind: "dropSection", tab: 0, a: 613, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
            { kind: "type", tab: 0, a: 0, b: 0 },
          ],
          true
        )
      )
    }))
})
