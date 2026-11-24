import fc from "fast-check"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"

import {
  revertOrigin,
  seedYDoc,
  writeDocument,
  type HistoryRow,
} from "./index.js"
import { cv, outline, para, snapshot } from "./test/room.js"

const COACH = "coach:1"

type Edit = { at: number; del: number; ins: string }

const edit = (insert: RegExp) =>
  fc.record({
    at: fc.nat(100),
    del: fc.nat(4),
    ins: fc.stringMatching(insert),
  })

const scenario = fc.record({
  texts: fc.array(fc.stringMatching(/^[a-z ]{4,14}$/), {
    minLength: 2,
    maxLength: 4,
  }),
  person: fc.array(
    fc.record({ block: fc.nat(3), change: edit(/^[A-Z]{0,3}$/) }),
    { maxLength: 5 }
  ),
  coach: fc.array(
    fc.record({
      drop: fc.boolean(),
      changes: fc.array(edit(/^[0-9]{0,3}$/), { maxLength: 3 }),
    }),
    { minLength: 4, maxLength: 4 }
  ),
  added: fc.array(
    fc.record({ after: fc.nat(4), text: fc.stringMatching(/^[0-9]{1,4}$/) }),
    { maxLength: 2 }
  ),
  coachFirst: fc.boolean(),
  personIdSortsFirst: fc.boolean(),
})

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never

function changed(text: string, { at, del, ins }: Edit): string {
  const pos = at % (text.length + 1)
  return text.slice(0, pos) + ins + text.slice(pos + del)
}

const LIVE_ID = 3

function fork(from: Uint8Array, clientID: number): Y.Doc {
  const doc = new Y.Doc()
  doc.clientID = clientID
  Y.applyUpdate(doc, from)
  return doc
}

function play(input: Scenario, protectTyped: boolean) {
  const seed = seedYDoc(
    cv(input.texts.map((text, index) => para(`p${index}`, text)))
  )
  const personDoc = fork(seed, input.personIdSortsFirst ? 1 : 2)
  const personTexts = [...input.texts]
  const typed = new Set<number>()
  const personRows: HistoryRow[] = []
  for (const { block, change } of input.person) {
    const index = block % personTexts.length
    personTexts[index] = changed(personTexts[index] ?? "", change)
    typed.add(index)
    const update = writeDocument(
      personDoc,
      cv(personTexts.map((text, at) => para(`p${at}`, text))),
      "person"
    )
    if (update) personRows.push({ update, origin: "person" })
  }

  const coachDoc = fork(seed, input.personIdSortsFirst ? 2 : 1)
  const target = input.texts.flatMap((text, index) => {
    const plan = input.coach[index]
    if (!plan || (plan.drop && !(protectTyped && typed.has(index)))) return []
    return [para(`p${index}`, plan.changes.reduce(changed, text))]
  })
  for (const [order, { after, text }] of input.added.entries()) {
    target.splice(after % (target.length + 1), 0, para(`c${order}`, text))
  }
  const update = writeDocument(coachDoc, cv(target), COACH)
  const coachRows: HistoryRow[] = update ? [{ update, origin: COACH }] : []

  const rows = input.coachFirst
    ? [...coachRows, ...personRows]
    : [...personRows, ...coachRows]
  const history: HistoryRow[] = [{ update: seed, origin: "seed" }, ...rows]
  const live = fork(seed, LIVE_ID)
  for (const row of rows) Y.applyUpdate(live, row.update, row.origin)
  return { live, history, personDoc, typed }
}

function subsequence(small: string, large: string): boolean {
  let cursor = 0
  for (const char of large) {
    if (char === small[cursor]) cursor++
  }
  return cursor === small.length
}

const capitals = (text: string) => text.replace(/[^A-Z]/g, "")

const SAME_CASES_ON_EVERY_RUN = 20261124

const CASE_A_RANDOM_RUN_FOUND = (personIdSortsFirst: boolean): Scenario => ({
  texts: ["  a    a  ", "aaa ", "a  a"],
  person: [{ block: 0, change: { at: 25, del: 0, ins: "A" } }],
  coach: [
    {
      drop: false,
      changes: [
        { at: 3, del: 0, ins: "0" },
        { at: 71, del: 0, ins: "0" },
        { at: 59, del: 2, ins: "" },
      ],
    },
    { drop: false, changes: [] },
    { drop: false, changes: [] },
    { drop: false, changes: [] },
  ],
  added: [],
  coachFirst: false,
  personIdSortsFirst,
})

function expectTypedKept(input: Scenario) {
  const { live, personDoc, typed } = play(input, true)
  const merged = new Map(outline(snapshot(live)))
  for (const [id, own] of outline(snapshot(personDoc))) {
    const text = merged.get(id)
    if (text === undefined) continue
    const kept = text.replace(/[0-9]/g, "")
    expect(capitals(kept)).toBe(capitals(own))
    expect(subsequence(kept, own)).toBe(true)
  }
  for (const index of typed) expect(merged.has(`p${index}`)).toBe(true)
}

describe("random person typing against a Coach write", () => {
  it("never loses a character the person typed and did not delete", () => {
    fc.assert(fc.property(scenario, expectTypedKept), {
      numRuns: 60,
      seed: SAME_CASES_ON_EVERY_RUN,
    })
  })

  it("keeps the typed character in the case a random run found, when the person's id sorts first", () => {
    expectTypedKept(CASE_A_RANDOM_RUN_FOUND(true))
  })

  it.fails(
    "#1802: keeps the typed character in the case a random run found, when the Coach's id sorts first",
    () => {
      expectTypedKept(CASE_A_RANDOM_RUN_FOUND(false))
    }
  )

  it("reverting the Coach origin yields exactly the person-only document", () => {
    fc.assert(
      fc.property(scenario, (input) => {
        const { live, history, personDoc } = play(input, false)
        const update = revertOrigin(history, COACH)
        if (update) Y.applyUpdate(live, update, `revert:${COACH}`)
        expect(outline(snapshot(live))).toEqual(outline(snapshot(personDoc)))
      }),
      { numRuns: 60, seed: SAME_CASES_ON_EVERY_RUN }
    )
  })
})
