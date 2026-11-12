import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { closeWritingDb } from "./canvas-save.ts"
import { invariant, shortest, walk } from "@/test/paper-page-walk.ts"
import { tally, walkSteps, type Step } from "@/test/paper-page-walk-world.ts"

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
    runContractCommand: (_client: unknown, _name: string, input: unknown) =>
      net.send(input),
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
  { kind: "type", line: 1, at: 99, text: " — I led a five-person team" },
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

describe("the writing page under a seeded random walk against a fake server", () => {
  it("replays the walk's seed 9: a newer page that arrives during a composition is not overwritten by the composed word", async () => {
    expect(await walk(COMPOSED_OVER_NEWER)).toBeNull()
  })

  it("replays review N1: a refused line next to a new line goes quiet and marks one line", async () => {
    expect(await walk(N1)).toBeNull()
  })

  it("replays review N2: a partial resend, an edit elsewhere and a reload never put old text over the newer edit", async () => {
    expect(await walk(N2)).toBeNull()
  })

  it(`keeps I1 to I4 over ${SEEDS} seeds of ${STEPS} steps`, async () => {
    const found = new Map<string, number[]>()
    for (let seed = FIRST_SEED; seed < FIRST_SEED + SEEDS; seed += 1) {
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
    ])
      expect(tally.get(name) ?? 0, name).toBeGreaterThan(0)
    expect(tally.get("left asking after close") ?? 0).toBe(0)
  })
})
