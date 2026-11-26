import fc from "fast-check"
import { describe, expect, it } from "vitest"
import type { JobStage, JobView } from "@workspace/domain/apply"

import { mockJob } from "@/test/apply-job-fixtures.ts"

import {
  afterMove,
  clearSettled,
  dropOn,
  noDrops,
  shownJobs,
  stageShown,
  type Drops,
} from "./apply-board-drops.ts"
import { BOARD_STAGES } from "./apply-stages.ts"

const CARDS = [
  "01900000-0000-7000-8000-000000000001",
  "01900000-0000-7000-8000-000000000002",
  "01900000-0000-7000-8000-000000000003",
]

type Fetch = { snapshot: Map<string, JobStage>; clears: boolean }

type World = {
  server: Map<string, JobStage>
  cache: Map<string, JobStage>
  drops: Drops
  queues: Map<string, JobStage[]>
  lastDrop: Map<string, JobStage>
  fetch: Fetch | null
  refreshedWhileQueued: boolean
}

type Op =
  | { type: "drop"; card: string; stage: JobStage }
  | { type: "commit"; card: string }
  | { type: "refetch" }
  | { type: "land" }

const ops = fc.array(
  fc.oneof(
    fc.record({
      type: fc.constant("drop" as const),
      card: fc.constantFrom(...CARDS),
      stage: fc.constantFrom(...BOARD_STAGES),
    }),
    fc.record({
      type: fc.constant("commit" as const),
      card: fc.constantFrom(...CARDS),
    }),
    fc.constant({ type: "refetch" as const }),
    fc.constant({ type: "land" as const })
  ),
  { maxLength: 60 }
)

function start(): World {
  const stages = new Map<string, JobStage>(CARDS.map((id) => [id, "saved"]))
  return {
    server: new Map(stages),
    cache: new Map(stages),
    drops: noDrops,
    queues: new Map(CARDS.map((id) => [id, []])),
    lastDrop: new Map(),
    fetch: null,
    refreshedWhileQueued: false,
  }
}

function jobsOf(world: World): JobView[] {
  return CARDS.map((id) =>
    mockJob({ id, stage: world.cache.get(id) ?? "saved" })
  )
}

function shown(world: World, id: string): JobStage {
  return (
    shownJobs(jobsOf(world), world.drops).find((job) => job.id === id)?.stage ??
    "saved"
  )
}

function anyQueued(world: World) {
  return [...world.queues.values()].some((queue) => queue.length > 0)
}

function startFetch(world: World, clears: boolean) {
  if (world.fetch?.clears && !clears) return
  world.fetch = { snapshot: new Map(world.server), clears }
}

function step(world: World, op: Op) {
  if (op.type === "drop") {
    if (shown(world, op.card) === op.stage) return
    world.drops = dropOn(world.drops, op.card, op.stage)
    world.cache.set(op.card, op.stage)
    world.queues.get(op.card)?.push(op.stage)
    world.lastDrop.set(op.card, op.stage)
  } else if (op.type === "commit") {
    const stage = world.queues.get(op.card)?.shift()
    if (!stage) return
    world.server.set(op.card, stage)
    const after = afterMove(world.drops, op.card)
    world.drops = after.drops
    if (after.refresh) {
      if (anyQueued(world)) world.refreshedWhileQueued = true
      startFetch(world, true)
    }
  } else if (op.type === "refetch") {
    startFetch(world, false)
  } else if (world.fetch) {
    const { snapshot, clears } = world.fetch
    world.fetch = null
    for (const [id, stage] of snapshot) world.cache.set(id, stage)
    if (clears && !anyQueued(world)) world.drops = clearSettled(world.drops)
  }
}

function settle(world: World) {
  for (const card of CARDS) {
    while ((world.queues.get(card)?.length ?? 0) > 0) {
      step(world, { type: "commit", card })
    }
  }
  step(world, { type: "land" })
}

describe("board drops under any order of moves, results and refetches", () => {
  it("shows every card in the column of its last drop at every step", () => {
    fc.assert(
      fc.property(ops, (plan) => {
        const world = start()
        for (const op of plan) {
          step(world, op)
          for (const [id, stage] of world.lastDrop) {
            expect(shown(world, id)).toBe(stage)
          }
        }
      }),
      { numRuns: 1000 }
    )
  })

  it("ends with the server, the read and the screen all on the last drop", () => {
    fc.assert(
      fc.property(ops, (plan) => {
        const world = start()
        for (const op of plan) step(world, op)
        settle(world)
        for (const id of CARDS) {
          const expected = world.lastDrop.get(id) ?? "saved"
          expect(world.server.get(id)).toBe(expected)
          expect(world.cache.get(id)).toBe(expected)
          expect(shown(world, id)).toBe(expected)
        }
        expect(world.drops.size).toBe(0)
      }),
      { numRuns: 1000 }
    )
  })

  it("starts the board refresh only when no move is queued", () => {
    fc.assert(
      fc.property(ops, (plan) => {
        const world = start()
        for (const op of plan) step(world, op)
        expect(world.refreshedWhileQueued).toBe(false)
      }),
      { numRuns: 1000 }
    )
  })

  it("lets a stage read from a stale refetch lose to a pending drop", () => {
    const drops = dropOn(
      noDrops,
      "01900000-0000-7000-8000-000000000001",
      "applied"
    )
    expect(
      stageShown(drops, "01900000-0000-7000-8000-000000000001", "saved")
    ).toBe("applied")
    expect(
      stageShown(
        clearSettled(
          afterMove(drops, "01900000-0000-7000-8000-000000000001").drops
        ),
        "01900000-0000-7000-8000-000000000001",
        "saved"
      )
    ).toBe("saved")
  })

  it("shows a dropped job last in its new column, where the move puts it", () => {
    const jobs = [
      "01900000-0000-7000-8000-000000000001",
      "01900000-0000-7000-8000-000000000002",
      "01900000-0000-7000-8000-000000000003",
      "01900000-0000-7000-8000-000000000004",
    ].map((id, index) =>
      mockJob({ id, stage: index === 0 ? "saved" : "applied" })
    )
    const drops = dropOn(
      dropOn(noDrops, "01900000-0000-7000-8000-000000000001", "applied"),
      "01900000-0000-7000-8000-000000000002",
      "applied"
    )
    const applied = (shown: JobView[]) =>
      shown.filter((job) => job.stage === "applied").map((job) => job.id)
    expect(applied(shownJobs(jobs, drops))).toEqual([
      "01900000-0000-7000-8000-000000000003",
      "01900000-0000-7000-8000-000000000004",
      "01900000-0000-7000-8000-000000000001",
      "01900000-0000-7000-8000-000000000002",
    ])
    expect(
      applied(
        shownJobs(
          jobs,
          dropOn(drops, "01900000-0000-7000-8000-000000000001", "applied")
        )
      )
    ).toEqual([
      "01900000-0000-7000-8000-000000000003",
      "01900000-0000-7000-8000-000000000004",
      "01900000-0000-7000-8000-000000000002",
      "01900000-0000-7000-8000-000000000001",
    ])
  })
})
