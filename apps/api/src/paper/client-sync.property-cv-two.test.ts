import { type PaperDocument } from "@workspace/domain"
import fc from "fast-check"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { play, useCoachStore, verdict } from "../test/cv-sync-play.js"
import { edited, wordsOf } from "../test/paper-client.js"

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

  it("keeps concurrent identical skill splits distinct from a later add", () =>
    h.inDatabase(async () => {
      const out = await play(
        [
          { kind: "skillSplit", tab: 0, a: 0, b: 0 },
          { kind: "skillSplit", tab: 1, a: 0, b: 0 },
          { kind: "type", tab: 0, a: 0, b: 0 },
          { kind: "skillAdd", tab: 0, a: 0, b: 0 },
          { kind: "type", tab: 0, a: 0, b: 0 },
        ],
        true
      )
      verdict(out)
      const current = out.final.doc
      if (current.kind !== "cv") throw new Error("Expected a CV")
      const skills = out.final.doc.blocks.find((block) => block.id === "k1")
      expect(skills?.type === "skills" ? skills.items : undefined).toEqual([
        "Figma",
        "SQL",
        "C",
        "C++",
      ])
      for (const word of out.live)
        expect(wordsOf(out.final.doc)).toContain(word)
      const reject = (doc: PaperDocument) => {
        const changed = {
          ...out,
          final: { ...out.final, doc },
          tabs: out.tabs.map((tab) => ({ ...tab, doc: () => doc })),
        }
        expect(() => verdict(changed)).toThrow()
      }
      const replaceSkills = (items: string[]) => ({
        ...current,
        blocks: current.blocks.map((block) =>
          block.type === "skills" ? { ...block, items } : block
        ),
      })
      reject(replaceSkills(["FigmaSQL", "C", "C++"]))
      reject(replaceSkills(["Figma", "SQL", "C", "C++", "fabricated"]))
      reject(replaceSkills(["Figma", "C", "C++"]))
      reject(edited(out.final.doc, "u1", () => "alpha beta"))
    }))

  it("supersedes identical skill splits after their replies are delivered", () =>
    h.inDatabase(async () => {
      const out = await play(
        [
          { kind: "skillSplit", tab: 0, a: 0, b: 0 },
          { kind: "skillSplit", tab: 1, a: 0, b: 0 },
          { kind: "sync", tab: 0, a: 0, b: 0 },
          { kind: "sync", tab: 1, a: 0, b: 0 },
          { kind: "skillAdd", tab: 1, a: 0, b: 0 },
        ],
        true
      )
      verdict(out)
      const current = out.final.doc
      if (current.kind !== "cv") throw new Error("Expected a CV")
      const doc = {
        ...current,
        blocks: current.blocks.map((block) =>
          block.type === "skills"
            ? { ...block, items: ["Figma", "SQL", "C", "C++"] }
            : block
        ),
      }
      expect(() =>
        verdict({
          ...out,
          final: { ...out.final, doc },
          tabs: out.tabs.map((tab) => ({ ...tab, doc: () => doc })),
        })
      ).toThrow("k1.items")
    }))

  it("does not publish a skill edit rejected by a stale push", () =>
    h.inDatabase(async () => {
      const out = await play(
        [
          { kind: "skillSplit", tab: 0, a: 0, b: 0 },
          { kind: "sync", tab: 0, a: 0, b: 0 },
          { kind: "skillDrop", tab: 1, a: 0, b: 0 },
          { kind: "launch", tab: 1, a: 0, b: 0 },
          { kind: "launch", tab: 0, a: 0, b: 0 },
          { kind: "deliver", tab: 0, a: 0, b: 0 },
          { kind: "skillDrop", tab: 0, a: 0, b: 0 },
        ],
        true
      )
      verdict(out)
      const skills = out.final.doc.blocks.find((block) => block.id === "k1")
      expect(skills?.type === "skills" ? skills.items : undefined).toEqual([
        "SQL",
        "C, C++",
      ])
    }))

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
