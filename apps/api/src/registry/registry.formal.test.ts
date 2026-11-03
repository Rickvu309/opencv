import { randomUUID } from "node:crypto"

import {} from "@workspace/domain"
import {} from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { getDb, withDatabase } from "../db/context.js"
import { activity, chats, idempotency } from "../db/schema.js"
import {} from "./errors.js"
import { Registry } from "./registry.js"
import {
  KNOWN_FINDING,
  isKnownFinding,
  NS,
  REAL,
  SEEDS,
  activityKeyed,
  backend,
  delaysFor,
  describeError,
  measure,
  newPerson,
  noteCaller,
  race,
  registry,
  registerBackendHooks,
  rowsOf,
  storedKeyed,
  trace,
} from "../test/registry-formal-support.js"

registerBackendHooks()

type KeyedCase = {
  command: string
  table: "jobs" | "papers" | "chats"
  input: (tag: string) => unknown
  writesActivity: boolean
}

const KEYED_CASES: KeyedCase[] = [
  {
    command: "job.create",
    table: "jobs",
    input: (tag) => ({ title: `Role ${tag}`, company: "Northwind" }),
    writesActivity: true,
  },
  {
    command: "paper.create",
    table: "papers",
    input: (tag) => ({ kind: "cv", name: `CV ${tag}` }),
    writesActivity: true,
  },
  {
    command: "chat.create",
    table: "chats",
    input: (tag) => ({ title: `Chat ${tag}` }),
    writesActivity: false,
  },
]

describe("P1: a keyed command runs once and every caller gets the replay", () => {
  for (const spec of KEYED_CASES) {
    it(`${spec.command}: one effect per key, same replay for 2 to 4 racing callers`, async () => {
      await withDatabase(backend.db, async () => {
        const control = await newPerson()
        await registry.execute({
          name: spec.command,
          input: spec.input("control"),
          actor: control.person,
          idempotencyKey: `control-${randomUUID()}`,
        })
        const unit = await rowsOf(spec.table, control.id)
        expect(
          unit,
          `${spec.command} creates a row, so the counts below are not vacuous`
        ).toBeGreaterThan(0)

        for (const n of NS) {
          for (const seed of SEEDS) {
            const { id: userId, person } = await newPerson()
            const key = `key-${randomUUID()}`
            const label = `P1 ${spec.command} N=${n} seed=${seed}`
            const outcomes = await measure(`P1 ${spec.command}`, () =>
              race(
                Array.from(
                  { length: n },
                  () => () =>
                    registry.execute({
                      name: spec.command,
                      input: spec.input(`${seed}-${n}`),
                      actor: person,
                      idempotencyKey: key,
                    })
                ),
                delaysFor(seed, n)
              )
            )
            outcomes.forEach((o) => noteCaller(label, o))

            expect(
              await rowsOf(spec.table, userId),
              `${label}: the effect ran once`
            ).toBe(unit)
            const raw = outcomes.filter(
              (o) => !o.ok && !isKnownFinding(o.error)
            )
            expect(
              raw.map((o) => (o.ok ? "" : describeError(o.error))),
              `${label}: raw database errors other than the pinned finding`
            ).toEqual([])
            const answers = outcomes.flatMap((o) => (o.ok ? [o.value] : []))
            expect(
              answers.length,
              `${label}: some caller answered`
            ).toBeGreaterThan(0)
            for (const answer of answers) {
              expect(
                answer.output,
                `${label}: every answer is the first answer`
              ).toEqual(answers[0]?.output)
              expect(answer.activityId, label).toEqual(answers[0]?.activityId)
            }
            if (spec.writesActivity) {
              const rows = await activityKeyed(userId, key)
              expect(rows.length, `${label}: activity rows`).toBe(1)
              expect(answers[0]?.activityId, label).toBe(rows[0]?.id)
            } else {
              expect(
                (await storedKeyed(userId, key)).length,
                `${label}: idempotency rows`
              ).toBe(1)
            }
          }
        }

        const { id: otherId, person: other } = await newPerson()
        const distinct = await race(
          [0, 1, 2].map(
            (i) => () =>
              registry.execute({
                name: spec.command,
                input: spec.input(`distinct-${i}`),
                actor: other,
                idempotencyKey: `distinct-${randomUUID()}`,
              })
          ),
          [0, 0, 0]
        )
        expect(
          distinct.every((o) => o.ok),
          "distinct keys all succeed"
        ).toBe(true)
        expect(
          await rowsOf(spec.table, otherId),
          "distinct keys are distinct effects"
        ).toBe(unit * 3)
      })
    }, 120_000)
  }

  it("measures whether the racing transactions really overlap", async () => {
    await withDatabase(backend.db, async () => {
      const { person } = await newPerson()
      const key = `key-${randomUUID()}`
      await measure("overlap probe job.create N=4", () =>
        race(
          [0, 1, 2, 3].map(
            () => () =>
              registry.execute({
                name: "job.create",
                input: { title: "Probe", company: "Northwind" },
                actor: person,
                idempotencyKey: key,
              })
          ),
          [0, 0, 0, 0]
        )
      )
      console.log(
        `[formal] backend=${backend.kind} transaction order for 4 racing callers: ${trace.order.join(" ")}`
      )
      if (backend.kind === "pglite") {
        expect(
          trace.maxActive,
          "PGlite runs one transaction at a time, so a missing FOR UPDATE cannot show here; update the verify-command-registry skill if this changes"
        ).toBe(1)
      } else {
        expect(
          trace.maxActive,
          "a real server runs the racing transactions side by side"
        ).toBeGreaterThan(1)
      }
    })
  })
})

function steerableChatsRowCommand(
  options: {
    transaction?: "none"
    draft: boolean
    beforeEffect?: (userId: string, key: string) => Promise<void>
  },
  name: string
) {
  const local = new Registry()
  local.addCommand(
    {
      name,
      description: "Formal check command.",
      input: z.object({ key: z.string() }).strict(),
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Formal check",
      activity: () =>
        options.draft
          ? { subjectKind: "chat", subjectId: "formal", summary: "Formal" }
          : null,
      ...(options.transaction ? { transaction: options.transaction } : {}),
    },
    async (input, actor) => {
      await options.beforeEffect?.(actor.userId, input.key)
      await getDb()
        .insert(chats)
        .values({ id: randomUUID(), userId: actor.userId, title: "Effect" })
      return { marker: randomUUID() }
    }
  )
  return local
}

async function insertRivalWinnerActivity(userId: string, key: string) {
  await getDb()
    .insert(activity)
    .values({
      id: randomUUID(),
      userId,
      actor: "person",
      command: "formal.rival",
      subjectKind: "chat",
      subjectId: "rival",
      summary: "Rival",
      result: { rival: true },
      idempotencyKey: key,
    })
}

async function insertRivalWinnerStored(userId: string, key: string) {
  await getDb()
    .insert(idempotency)
    .values({ userId, key, command: "formal.rival", result: { rival: true } })
}

describe("P1: the key conflict path", () => {
  const pinnedFinding = it.fails

  it("replays the winner when the command is not inside a transaction (activity row)", async () => {
    await withDatabase(backend.db, async () => {
      const { id: userId, person } = await newPerson()
      const key = `key-${randomUUID()}`
      const local = steerableChatsRowCommand(
        {
          transaction: "none",
          draft: true,
          beforeEffect: insertRivalWinnerActivity,
        },
        "formal.autocommit"
      )
      const result = await local.execute({
        name: "formal.autocommit",
        input: { key },
        actor: person,
        idempotencyKey: key,
      })
      const rows = await activityKeyed(userId, key)
      expect(rows.length).toBe(1)
      expect(result.activityId).toBe(rows[0]?.id)
      expect(result.output).toEqual({ rival: true })
    })
  })

  it("replays the winner when the command is not inside a transaction (stored result)", async () => {
    await withDatabase(backend.db, async () => {
      const { id: userId, person } = await newPerson()
      const key = `key-${randomUUID()}`
      const local = steerableChatsRowCommand(
        {
          transaction: "none",
          draft: false,
          beforeEffect: insertRivalWinnerStored,
        },
        "formal.autocommit.stored"
      )
      const result = await local.execute({
        name: "formal.autocommit.stored",
        input: { key },
        actor: person,
        idempotencyKey: key,
      })
      expect((await storedKeyed(userId, key)).length).toBe(1)
      expect(result.output).toEqual({ rival: true })
    })
  })

  pinnedFinding(
    `${KNOWN_FINDING.issue}: a lost key race inside a transaction replays the winner (activity row)`,
    async () => {
      await withDatabase(backend.db, async () => {
        const { id: userId, person } = await newPerson()
        const key = `key-${randomUUID()}`
        const local = steerableChatsRowCommand(
          { draft: true, beforeEffect: insertRivalWinnerActivity },
          "formal.transactional"
        )
        const result = await local.execute({
          name: "formal.transactional",
          input: { key },
          actor: person,
          idempotencyKey: key,
        })
        const rows = await activityKeyed(userId, key)
        expect(rows.length).toBe(1)
        expect(result.activityId).toBe(rows[0]?.id)
      })
    }
  )

  pinnedFinding(
    `${KNOWN_FINDING.issue}: a lost key race inside a transaction replays the winner (stored result)`,
    async () => {
      await withDatabase(backend.db, async () => {
        const { person } = await newPerson()
        const key = `key-${randomUUID()}`
        const local = steerableChatsRowCommand(
          { draft: false, beforeEffect: insertRivalWinnerStored },
          "formal.transactional.stored"
        )
        const result = await local.execute({
          name: "formal.transactional.stored",
          input: { key },
          actor: person,
          idempotencyKey: key,
        })
        expect(result.output).toEqual({ rival: true })
      })
    }
  )

  const pinnedFindingOnRealServer = REAL ? it.fails : it.skip
  pinnedFindingOnRealServer(
    `${KNOWN_FINDING.issue}: callers that pass the key lookup together all get the replay`,
    async () => {
      await withDatabase(backend.db, async () => {
        const { person } = await newPerson()
        const key = `key-${randomUUID()}`
        const n = 3
        let arrived = 0
        const gate = new Promise<void>((open) => {
          const wait = setInterval(() => {
            if (arrived >= n) {
              clearInterval(wait)
              open()
            }
          }, 5)
        })
        const local = steerableChatsRowCommand(
          {
            draft: true,
            beforeEffect: async () => {
              arrived += 1
              await gate
            },
          },
          "formal.barrier"
        )
        const outcomes = await race(
          Array.from(
            { length: n },
            () => () =>
              local.execute({
                name: "formal.barrier",
                input: { key },
                actor: person,
                idempotencyKey: key,
              })
          ),
          [0, 0, 0]
        )
        expect(
          outcomes.map((o) => (o.ok ? "replay" : describeError(o.error)))
        ).toEqual(Array(n).fill("replay"))
      })
    }
  )
})
