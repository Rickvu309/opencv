import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { closeWritingDb } from "./canvas-save.ts"
import {
  invariant,
  lookKey,
  lookTrail,
  shortest,
  walk,
} from "@/test/paper-page-walk.ts"
import {
  tally,
  walkSteps,
  type StartLine,
  type Step,
} from "@/test/paper-page-walk-world.ts"

vi.mock("./package-read.ts", async () => {
  const { net } = await import("@/test/paper-page-walk-world.ts")
  return {
    readWordPage: (_owner: string, docId: string, signal: AbortSignal) =>
      net.read(docId, signal),
  }
})

vi.mock("@/lib/contract-client.ts", async (original) => {
  const { net } = await import("@/test/paper-page-walk-world.ts")
  return {
    ...(await original<object>()),
    runContractCommand: (
      _client: unknown,
      _name: string,
      input: unknown,
      options?: { idempotencyKey?: string }
    ) => net.send(input, options?.idempotencyKey),
  }
})

const SEEDS = Number(process.env.WALK_SEEDS ?? 200)
const STEPS = Number(process.env.WALK_STEPS ?? 1500)
const FIRST_SEED = Number(process.env.WALK_FIRST_SEED ?? 1)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
})

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
  await closeWritingDb()
})

const N1: Step[] = [
  { kind: "network", online: false },
  { kind: "enter", line: 3, at: 99 },
  { kind: "type", line: 4, at: 0, text: "New line" },
  { kind: "type", line: 2, at: 0, text: "Also §" },
  { kind: "type", line: 2, at: 99, text: "!" },
  { kind: "drain" },
  { kind: "network", online: true },
  { kind: "drain" },
  { kind: "drain" },
  { kind: "reload" },
  { kind: "drain" },
  { kind: "type", line: 0, at: 4, text: "Q" },
  { kind: "drain" },
]

const N2: Step[] = [
  { kind: "network", online: false },
  { kind: "type", line: 1, at: 99, text: " \u2014 I led a five-person team" },
  { kind: "type", line: 2, at: 0, text: "Also §" },
  { kind: "drain" },
  { kind: "network", online: true },
  { kind: "drain" },
  { kind: "elsewhere", line: 3, change: "edit" },
  { kind: "reload" },
  { kind: "type", line: 0, at: 4, text: "Q" },
  { kind: "drain" },
  { kind: "type", line: 3, at: 99, text: " & Exchange" },
  { kind: "drain" },
  { kind: "useSaved" },
  { kind: "drain" },
]

const COMPOSED_OVER_NEWER: Step[] = [
  { kind: "answer", pick: 4, fault: "none" },
  { kind: "elsewhere", line: 21, change: "delete" },
  { kind: "type", line: 53, at: 20, text: "a " },
  { kind: "answer", pick: 0, fault: "none" },
  { kind: "useSaved" },
  { kind: "composeStart", line: 23 },
  { kind: "elsewhere", line: 20, change: "edit" },
  { kind: "drain" },
  { kind: "composeEnd", text: "fid" },
]

const SEED_501: Step[] = [
  { kind: "type", line: 21, at: 37, text: "¤e" },
  { kind: "enter", line: 1, at: 33 },
  { kind: "drain" },
  { kind: "enter", line: 13, at: 20 },
  { kind: "paste", line: 30, text: "fjcjh\nk\nah" },
  { kind: "drain" },
  { kind: "reload" },
  { kind: "answer", pick: 4, fault: "none" },
  { kind: "useSaved" },
  { kind: "deleteLine", line: 7 },
  { kind: "drain" },
  { kind: "enter", line: 45, at: 37 },
  { kind: "join", line: 5 },
  { kind: "reload" },
  { kind: "join", line: 40 },
  { kind: "elsewhere", line: 57, change: "delete" },
]

const SEED_664: Step[] = [
  { kind: "join", line: 34 },
  { kind: "drain" },
  { kind: "elsewhere", line: 17, change: "delete" },
  { kind: "type", line: 57, at: 24, text: "dcci" },
  { kind: "answer", pick: 0, fault: "none" },
  { kind: "useSaved" },
  { kind: "enter", line: 36, at: 62 },
  { kind: "deleteLine", line: 4 },
  { kind: "reload" },
  { kind: "paste", line: 33, text: "jc\nff\na hhf" },
  { kind: "elsewhere", line: 30, change: "edit" },
  { kind: "enter", line: 18, at: 37 },
  { kind: "enter", line: 8, at: 37 },
  { kind: "deleteLine", line: 18 },
]

describe("the writing page under a seeded random walk against a fake server", () => {
  it("replays seed 1072 at 3,000 steps: after a reload the page knows its own save and shows no changed-elsewhere bar", async () => {
    expect(await walk(walkSteps(1072, 3000))).toBeNull()
  })

  it("replays seed 501: a removed line that still has a temporary id is counted in Use the saved page", async () => {
    expect(await walk(SEED_501)).toBeNull()
  })

  it("replays seed 664: a removed line edited elsewhere is counted in Use the saved page", async () => {
    expect(await walk(SEED_664)).toBeNull()
  })

  it("replays the walk's seed 9: a newer page that arrives during a composition is not overwritten by the composed word", async () => {
    expect(await walk(COMPOSED_OVER_NEWER)).toBeNull()
  })

  it("replays review N1: a refused line next to a new line goes quiet and marks one line", async () => {
    expect(await walk(N1)).toBeNull()
  })

  it("replays review N2: a partial resend, an edit elsewhere and a reload never put old text over the newer edit", async () => {
    expect(await walk(N2)).toBeNull()
  })

  it(`keeps I1 to I5 over ${SEEDS} seeds of ${STEPS} steps`, async () => {
    const found = new Map<string, number[]>()
    const seeds = process.env.WALK_SEED_LIST
      ? process.env.WALK_SEED_LIST.split(",").map(Number)
      : Array.from({ length: SEEDS }, (_, index) => FIRST_SEED + index)
    for (const seed of seeds) {
      const steps = walkSteps(seed, STEPS)
      const failure = await walk(steps)
      if (!failure) continue
      const at = Number(failure.split(" at ").at(-1))
      if (process.env.WALK_SURVEY) {
        found.set(invariant(failure) ?? "", [
          ...(found.get(invariant(failure) ?? "") ?? []),
          seed,
        ])
        continue
      }
      const short = await shortest(steps.slice(0, at + 1), failure)
      throw new Error(
        `seed ${seed}: ${failure}\nshortest ${short.length} steps:\n${JSON.stringify(short)}\nlast: ${await walk(short)}`
      )
    }
    if (found.size > 0)
      throw new Error(
        `seeds by invariant: ${JSON.stringify(Object.fromEntries(found))}`
      )
  }, 600_000)

  it("reaches every kind of state it claims to cover", () => {
    if (process.env.WALK_STATS)
      console.log(JSON.stringify(Object.fromEntries(tally)))
    for (const name of [
      "applied",
      "line refused",
      "stale",
      "moved",
      "page refused",
      "several lines marked",
      "removal marked",
      "use saved page",
      "restore line",
      "saved",
      "I5 new line checked",
    ])
      expect(tally.get(name) ?? 0, name).toBeGreaterThan(0)
    expect(tally.get("left asking after close") ?? 0).toBe(0)
  })
})

const BLANK: StartLine[] = [{ text: "", look: { align: "center" } }]

const PAGES: Record<string, StartLine[]> = {
  "a blank CV": BLANK,
  "a plain blank page": [{ text: "" }],
  "a template": [
    { text: "Your Name", look: { form: { kind: "title" }, align: "center" } },
    { text: "Experience", look: { form: { kind: "heading", level: 1 } } },
    {
      text: "Led a team of five",
      look: { form: { kind: "bullet", level: 0 } },
    },
    { text: "Write a short summary here" },
  ],
  "an imported file": [
    { text: "Linh Nguyen", look: { align: "center" } },
    { text: "Hanoi, Vietnam", look: { align: "end" } },
    { text: "I plan growth that ships.", look: { align: "justify" } },
    { text: "Projects", look: { form: { kind: "heading", level: 2 } } },
    { text: "First result", look: { form: { kind: "number", level: 0 } } },
    { text: "An indented line with spacing" },
  ],
}

function listed(line: StartLine) {
  const kind = line.look?.form?.kind
  return kind === "bullet" || kind === "number"
}

function lookName(line: StartLine) {
  return line.look ? lookKey(line.look) : "left, no look"
}

function looksAt(index: number) {
  return [...new Set(lookTrail.slice(1).map((lines) => lines[index]?.look))]
}

describe("a line's look is the same before its save, after the save lands and after a reload", () => {
  it("I5 compares marks at each character", () => {
    expect(
      lookKey({ spans: [{ from: 0, to: 1, marks: ["bold"] }] }, "ab")
    ).not.toBe(lookKey({ marks: [[], ["bold"]] }, "ab"))
    expect(
      lookKey({ spans: [{ from: 0, to: 1, marks: ["bold"] }] }, "ab")
    ).toBe(lookKey({ marks: [["bold"], []] }, "ab"))
  })

  for (const mark of ["bold", "italic", "underline"] as const)
    for (const trailing of [false, true])
      for (const saveBetween of [false, true])
        it(`Enter inherits ${trailing ? mark : "plain"} with save between keys ${saveBetween}`, async () => {
          const start: StartLine[] = [
            {
              text: "Lead tail",
              look: {
                marks: Array.from({ length: 9 }, (_, index) =>
                  index >= 4 === trailing ? [mark] : []
                ),
              },
            },
          ]
          const steps: Step[] = [{ kind: "enter", line: 0, at: 999 }]
          if (saveBetween) steps.push({ kind: "drain" })
          steps.push(
            { kind: "type", line: 1, at: 0, text: "Next" },
            { kind: "drain" },
            { kind: "reload" },
            { kind: "drain" }
          )
          expect(await walk(steps, start)).toBeNull()
          expect(lookTrail.at(-1)?.[1]?.look).toBe(
            lookKey(
              {
                marks: Array.from({ length: 4 }, () =>
                  trailing ? [mark] : []
                ),
              },
              "Next"
            )
          )
        })

  it("B1: a name line on a blank CV and four lines typed under it stay centred", async () => {
    const steps: Step[] = [
      { kind: "type", line: 0, at: 0, text: "Linh Nguyen" },
    ]
    for (const [index, text] of [
      "Marketing Intern",
      "Hanoi",
      "linh@example.com",
      "Available from June",
    ].entries())
      steps.push(
        { kind: "enter", line: index, at: 999 },
        { kind: "type", line: index + 1, at: 0, text }
      )
    steps.push({ kind: "drain" }, { kind: "reload" }, { kind: "drain" })
    expect(await walk(steps, BLANK)).toBeNull()
    const centred = lookKey({ align: "center" })
    expect(lookTrail.at(-1)?.map((line) => line.text)).toEqual([
      "Linh Nguyen",
      "Marketing Intern",
      "Hanoi",
      "linh@example.com",
      "Available from June",
    ])
    expect(
      new Set(lookTrail.flatMap((lines) => lines.map((line) => line.look)))
    ).toEqual(new Set([centred]))
  })

  for (const [name, start] of Object.entries(PAGES))
    start.forEach((line, index) => {
      const places: [string, number][] =
        line.text === ""
          ? [["end", 999]]
          : [
              ["start", 0],
              ["middle", Math.floor(line.text.length / 2)],
              ["end", 999],
            ]
      for (const [where, at] of places)
        it(`${name}, line ${index + 1} (${lookName(line)}): Enter at the ${where}`, async () => {
          expect(
            await walk(
              [
                { kind: "enter", line: index, at },
                { kind: "type", line: index + 1, at: 0, text: "Z" },
                { kind: "drain" },
                { kind: "reload" },
                { kind: "drain" },
              ],
              start
            )
          ).toBeNull()
          if (listed(line)) {
            expect(lookTrail.at(-1)?.length).toBe(start.length)
            expect(looksAt(index)).toEqual([lookKey(line.look)])
            return
          }
          expect(lookTrail.at(-1)?.length).toBe(start.length + 1)
          expect(looksAt(index)).toEqual([lookKey(line.look)])
          expect(looksAt(index + 1)).toEqual([lookKey(line.look)])
        })
      const previous = start[index - 1]
      if (previous && !listed(previous) && !listed(line))
        it(`${name}: Backspace joins line ${index + 1} (${lookName(line)}) into line ${index} (${lookName(previous)}), which keeps its look`, async () => {
          expect(
            await walk(
              [
                { kind: "join", line: index },
                { kind: "drain" },
                { kind: "reload" },
                { kind: "drain" },
              ],
              start
            )
          ).toBeNull()
          expect(lookTrail.at(-1)?.[index - 1]?.text).toBe(
            previous.text + line.text
          )
          expect(looksAt(index - 1)).toEqual([lookKey(previous.look)])
        })
      if (!listed(line))
        it(`${name}: three lines pasted at the end of line ${index + 1} (${lookName(line)}) take its look`, async () => {
          expect(
            await walk(
              [
                { kind: "paste", line: index, text: "one\ntwo\nthree" },
                { kind: "drain" },
                { kind: "reload" },
                { kind: "drain" },
              ],
              start
            )
          ).toBeNull()
          expect(
            lookTrail
              .at(-1)
              ?.slice(index, index + 3)
              .map((item) => item.text)
          ).toEqual([`${line.text}one`, "two", "three"])
          for (const at of [index, index + 1, index + 2])
            expect(looksAt(at)).toEqual([lookKey(line.look)])
        })
    })
})
