import { randomUUID } from "node:crypto"
import {
  coachTaskContract,
  coachStartOutputSchema,
  parseChatId,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterEach, expect, it } from "vitest"
import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  chats,
  chatMessages,
  coachTasks,
  coachUsage,
  user,
} from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { openBackend, REAL } from "../test/registry-formal-support.js"
import { append, claim } from "./task-store.js"
import { readTaskEvents, taskSnapshot } from "./task-reader.js"

const coachStartInputSchema = coachTaskContract["coach.start"].input
const previous = process.env.COACH_TASK_WORKER
const runtime = process.env.COACH_RUNTIME

afterEach(() => {
  if (previous === undefined) delete process.env.COACH_TASK_WORKER
  else process.env.COACH_TASK_WORKER = previous
  if (runtime === undefined) delete process.env.COACH_RUNTIME
  else process.env.COACH_RUNTIME = runtime
})

async function fixture(
  run: (ctx: Awaited<ReturnType<typeof seed>>) => Promise<void>
) {
  process.env.COACH_TASK_WORKER = "internal"
  process.env.COACH_RUNTIME = "fake"
  const backend = await openBackend()
  try {
    await withDatabase(backend.db, async () => run(await seed()))
  } finally {
    await backend.close()
  }
}

async function seed() {
  const ownerId = randomUUID(),
    chatId = parseChatId(randomUUID())
  await getDb()
    .insert(user)
    .values({ id: ownerId, name: "Ada", email: `${ownerId}@example.com` })
  await getDb()
    .insert(chats)
    .values({ id: chatId, userId: ownerId, title: "Durable start" })
  const registry = installRegistry()
  const input = coachStartInputSchema.parse({
    chatId,
    startKey: randomUUID(),
    text: "Prepare",
  })
  const start = async () =>
    coachStartOutputSchema.parse(
      (
        await registry.execute({
          name: "coach.start",
          input,
          actor: personActor(ownerId),
        })
      ).output
    )
  return { ownerId, chatId, registry, input, start }
}

it.skipIf(!REAL)(
  "concurrent starts on separate connections admit one task, message, usage and receipt",
  () =>
    fixture(async ({ start }) => {
      const [a, b] = await Promise.all([start(), start()])
      expect(a).toEqual(b)
      expect(await getDb().select().from(coachTasks)).toHaveLength(1)
      expect(await getDb().select().from(chatMessages)).toHaveLength(1)
      expect(await getDb().select().from(coachUsage)).toHaveLength(1)
    })
)

it.skipIf(!REAL)(
  "a snapshot waits for the event writer and returns its committed cursor and events together",
  () =>
    fixture(async ({ start, ownerId }) => {
      const { taskId } = await start()
      const { lease } = (await claim({
        workerId: "snapshot-writer",
        leaseMs: 60000,
      }))!
      let ready!: () => void, release!: () => void
      const entered = new Promise<void>((resolve) => {
        ready = resolve
      })
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      const writer = transaction(async () => {
        await append(lease, { kind: "draft", payload: { text: "First" } })
        ready()
        await held
        await append(lease, { kind: "draft", payload: { text: "Second" } })
      })
      await entered
      const reading = taskSnapshot(taskId, ownerId)
      release()
      await writer
      const snapshot = await reading
      expect(snapshot.cursor).toBe(2)
      expect(snapshot.events.map((event) => event.seq)).toEqual([0, 1, 2])
      expect(snapshot.events.at(-1)?.payload).toEqual({ text: "Second" })
    })
)

it("the reader advances only through contiguous bounded batches and rechecks ownership", () =>
  fixture(async ({ start, ownerId }) => {
    const { taskId } = await start()
    const { lease } = (await claim({
      workerId: "batch-writer",
      leaseMs: 60000,
    }))!
    for (let seq = 1; seq <= 103; seq++)
      await append(lease, { kind: "draft", payload: { text: String(seq) } })
    const first = await readTaskEvents(taskId, ownerId, -1)
    expect(first.type).toBe("events")
    if (first.type !== "events") throw new Error("Unexpected reset")
    expect(first.events).toHaveLength(100)
    expect(first.cursor).toBe(99)
    const second = await readTaskEvents(taskId, ownerId, first.cursor)
    expect(second.type).toBe("events")
    if (second.type !== "events") throw new Error("Unexpected reset")
    expect(second.events.map((event) => event.seq)).toEqual([
      100, 101, 102, 103,
    ])
    await expect(
      readTaskEvents(taskId, randomUUID(), second.cursor)
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(
      (
        await getDb().select().from(coachTasks).where(eq(coachTasks.id, taskId))
      )[0]?.cancelRequestedAt
    ).toBeNull()
  }))
