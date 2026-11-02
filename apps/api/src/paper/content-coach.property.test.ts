import fc from "fast-check"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { withText } from "../test/paper-content.js"

const userId = "user-coach-property"
const ORIGINAL = "First paragraph."
const PERSON_CHARS = "ABCDEGHIJKLMNOPQRSTUVWXYZ"
const COACH_CHARS = "0123456789"

let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const stepArbitrary = fc.record({
  coach: fc.boolean(),
  at: fc.nat(60),
  back: fc.nat(60),
})

function inserted(text: string, at: number, char: string) {
  const cut = at % (text.length + 1)
  return `${text.slice(0, cut)}${char}${text.slice(cut)}`
}

function withoutPersonChars(text: string) {
  return [...text].filter((char) => !PERSON_CHARS.includes(char)).join("")
}

describe("random person and Coach edits", () => {
  it("never lose a person character, and undo takes back only the Coach's", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(stepArbitrary, { minLength: 3, maxLength: 5 }),
        async (steps) => {
          await h.inDatabase(async () => {
            const { docId, client } = await h.created()
            const textAt = new Map<number, string>([[1, ORIGINAL]])
            let revision = 1
            let people = 0
            let coaches = 0
            const activityIds: string[] = []
            const remember = async () => {
              textAt.set(revision, (await h.textOf(docId, "t1")) ?? "")
            }
            for (const step of steps) {
              if (step.coach && coaches < COACH_CHARS.length) {
                const known = [...textAt.keys()]
                const basedOn = known[step.back % known.length]!
                const text = inserted(
                  textAt.get(basedOn)!,
                  step.at,
                  COACH_CHARS[coaches++]!
                )
                const result = await h.coach(docId, basedOn, [
                  { op: "setText", blockId: "t1", text },
                ])
                expect(result.output.editId).not.toBeNull()
                revision = result.output.revision
                activityIds.push(result.activityId!)
              } else {
                const current = textAt.get(revision)!
                const text = inserted(
                  current,
                  step.at,
                  PERSON_CHARS[people++ % PERSON_CHARS.length]!
                )
                await h.person(docId, client, (paper) =>
                  withText(paper, "t1", text)
                )
                revision += 1
              }
              await remember()
            }
            const typedByPerson = PERSON_CHARS.slice(0, people)
            const final = (await h.textOf(docId, "t1")) ?? ""
            for (const char of typedByPerson) expect(final).toContain(char)
            for (const activityId of activityIds.reverse()) {
              await h.store.registry.undo(userId, activityId)
              const now = (await h.textOf(docId, "t1")) ?? ""
              for (const char of typedByPerson) expect(now).toContain(char)
            }
            const reverted = (await h.textOf(docId, "t1")) ?? ""
            expect(withoutPersonChars(reverted)).toBe(ORIGINAL)
          })
        }
      ),
      { numRuns: 6, seed: 20261102 }
    )
  })
})
