import { randomUUID } from "node:crypto"
import { coachActor, defineOperation, personActor } from "@workspace/domain"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"

import {
  getDb,
  insideTransaction,
  transaction,
  withDatabase,
} from "../db/context.js"
import {
  activity,
  chats,
  coachTasks,
  coachUsage,
  idempotency,
  pendingActions,
  toolIntents,
  user,
} from "../db/schema.js"
import { seedTask } from "../test/coach-task-support.js"
import {
  backend,
  registerBackendHooks,
  trace,
  REAL,
} from "../test/registry-formal-support.js"
import { bindCatalog, type OperationBinding } from "./bind.js"
import { inputHash } from "./receipt.js"
import { Registry } from "./registry.js"

registerBackendHooks()

const operation = defineOperation({
  kind: "command",
  owner: "fixture",
  name: "fixture.review",
  version: 1,
  description: "Review a replacement",
  coach: "confirm",
  destructive: false,
  idempotency: "keyed",
  writes: () => [],
  input: z.object({ before: z.string(), after: z.string().trim() }).strict(),
  publicResult: z.object({ text: z.string() }).strict(),
})
const candidate = z
  .object({ artifact: z.string(), before: z.string(), after: z.string() })
  .strict()
const review = z.object({ before: z.string(), after: z.string() }).strict()
type Input = z.output<typeof operation.input>
type Candidate = z.output<typeof candidate>
type Review = z.output<typeof review>
const words = { before: "Ada", after: "Grace" }

function fixture(
  options: {
    silent?: boolean
    prepare?: () => Promise<void>
    fail?: boolean
    version?: string
  } = {}
) {
  const calls = { prepare: 0, commit: 0, revalidate: 0 }
  const binding = {
    operation,
    reviewed: {
      version: options.version ?? "fixture-v1",
      candidate,
      review,
      prepare: async (input: Input) => {
        calls.prepare++
        expect(insideTransaction()).toBe(false)
        expect(trace.active).toBe(0)
        await options.prepare?.()
        await Promise.resolve()
        expect(insideTransaction()).toBe(false)
        return {
          candidate: { ...input, artifact: `private-${randomUUID()}` },
          review: { ...input },
        }
      },
      revalidate: async (
        input: Input,
        prepared: { candidate: Candidate; review: Review },
        actor: { userId: string }
      ) => {
        calls.revalidate++
        expect(insideTransaction()).toBe(true)
        const [head] = await getDb()
          .select()
          .from(user)
          .where(eq(user.id, actor.userId))
        if (
          head?.name !== input.before ||
          prepared.candidate.after !== input.after ||
          prepared.review.after !== input.after
        )
          throw new Error("Basis conflict")
      },
      commit: async (
        _input: Input,
        prepared: { candidate: Candidate; review: Review },
        actor: { userId: string }
      ) => {
        calls.commit++
        expect(insideTransaction()).toBe(true)
        await getDb()
          .update(user)
          .set({ name: prepared.candidate.after })
          .where(eq(user.id, actor.userId))
        if (options.fail) throw new Error("Commit refused")
        return { text: prepared.candidate.after }
      },
    },
    activity: (
      _input: Input,
      result: { text: string },
      actor: { userId: string }
    ) =>
      options.silent
        ? null
        : {
            subjectKind: "account" as const,
            subjectId: actor.userId,
            summary: result.text,
          },
  } satisfies OperationBinding<
    typeof operation,
    { text: string },
    Candidate,
    Review
  >
  const registry = new Registry()
  bindCatalog(registry, { "fixture.review": binding })
  return { registry, calls }
}

async function owner() {
  const id = randomUUID(),
    chatId = randomUUID(),
    turnId = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: "Ada", email: `${id}@test.local` })
  await getDb()
    .insert(chats)
    .values({ id: chatId, userId: id, title: "Review" })
  await getDb().insert(coachUsage).values({
    id: turnId,
    userId: id,
    chatId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
  return { id, person: personActor(id), coach: coachActor(id, chatId, turnId) }
}

const run = (effect: () => Promise<void>) => withDatabase(backend.db, effect)
async function receiptCount(id: string) {
  const rows = await getDb()
    .select()
    .from(activity)
    .where(eq(activity.userId, id))
  const keys = await getDb()
    .select()
    .from(idempotency)
    .where(eq(idempotency.userId, id))
  return rows.length + keys.length
}
async function nameOf(id: string) {
  return (await getDb().select().from(user).where(eq(user.id, id)))[0]?.name
}

it("person preparation is outside SQL and a keyed retry keeps one receipt", () =>
  run(async () => {
    const { id, person } = await owner(),
      { registry, calls } = fixture()
    const execute = (input: Input) =>
      registry.execute({
        name: operation.name,
        input,
        actor: person,
        idempotencyKey: id,
      })
    const first = await execute({ ...words, after: " Grace " })
    expect(first.output).toEqual({ text: "Grace" })
    expect(await execute(words)).toMatchObject({
      activityId: first.activityId,
      output: first.output,
      pending: false,
    })
    await expect(execute({ ...words, after: "Other" })).rejects.toMatchObject({
      code: "CONFLICT",
    })
    expect(calls.prepare).toBe(1)
    expect(calls.commit).toBe(1)
    expect(await receiptCount(id)).toBe(1)
  }))

it("ambient transaction entry refuses before any preparation", () =>
  run(async () => {
    const { person } = await owner(),
      { registry, calls } = fixture()
    await expect(
      transaction(() =>
        registry.execute({ name: operation.name, input: words, actor: person })
      )
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(calls.prepare).toBe(0)
  }))

it("pending replay preserves proposal and public review; approval loads the frozen candidate without preparing", () =>
  run(async () => {
    const { id, coach } = await owner(),
      { registry, calls } = fixture()
    const options = {
      name: operation.name,
      input: words,
      actor: coach,
      idempotencyKey: id,
    }
    const first = await registry.execute(options)
    expect(first.pending).toBe(true)
    expect(first.review).toEqual(words)
    expect(JSON.stringify(first)).not.toContain("private-")
    expect(await registry.execute(options)).toEqual(first)
    expect(calls.prepare).toBe(1)
    await expect(
      registry.execute({ ...options, input: { ...words, after: "Other" } })
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(calls.prepare).toBe(1)
    await expect(
      fixture({ version: "fixture-v2" }).registry.approve(
        id,
        first.pendingActionId!
      )
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(await nameOf(id)).toBe("Ada")
    const restarted = fixture()
    const receipt = await restarted.registry.approve(id, first.pendingActionId!)
    expect(receipt?.result).toEqual({ text: "Grace" })
    expect(restarted.calls.prepare).toBe(0)
    expect(
      await restarted.registry.approve(id, first.pendingActionId!)
    ).toEqual(receipt)
    expect(restarted.calls.commit).toBe(1)
    expect(await registry.execute(options)).toMatchObject({
      activityId: receipt?.id,
      pending: false,
    })
    expect(await receiptCount(id)).toBe(1)
  }))

it.each(["candidate", "review", "version", "missing"])(
  "an altered %s refuses approval without a write",
  (change) =>
    run(async () => {
      const { id, coach } = await owner(),
        { registry } = fixture()
      const proposed = await registry.execute({
        name: operation.name,
        input: words,
        actor: coach,
        idempotencyKey: id,
      })
      const [row] = await getDb()
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.id, proposed.pendingActionId!))
      const frozen = z
        .object({ candidate, review, bindingVersion: z.string() })
        .passthrough()
        .parse(row!.frozenReview)
      if (change === "candidate") frozen.candidate.after = "Altered"
      if (change === "review") frozen.review.after = "Altered"
      if (change === "version") frozen.bindingVersion = "other"
      await getDb()
        .update(pendingActions)
        .set({ frozenReview: change === "missing" ? null : frozen })
        .where(eq(pendingActions.id, row!.id))
      await expect(registry.approve(id, row!.id)).rejects.toMatchObject({
        code: "CONFLICT",
      })
      expect(await nameOf(id)).toBe("Ada")
      expect(
        await getDb().select().from(activity).where(eq(activity.userId, id))
      ).toHaveLength(0)
    })
)

it("a changed basis refuses the saved candidate rather than preparing another", () =>
  run(async () => {
    const { id, coach } = await owner(),
      { registry, calls } = fixture()
    const proposed = await registry.execute({
      name: operation.name,
      input: words,
      actor: coach,
      idempotencyKey: id,
    })
    await getDb()
      .update(user)
      .set({ name: "Later words" })
      .where(eq(user.id, id))
    await expect(
      registry.approve(id, proposed.pendingActionId!)
    ).rejects.toThrow("Basis conflict")
    expect(calls.prepare).toBe(1)
    expect(calls.commit).toBe(0)
    expect(await nameOf(id)).toBe("Later words")
  }))

it("declined proposals cannot become a new proposal on keyed retry", () =>
  run(async () => {
    const { id, coach } = await owner(),
      { registry, calls } = fixture()
    const options = {
      name: operation.name,
      input: words,
      actor: coach,
      idempotencyKey: id,
    }
    const proposed = await registry.execute(options)
    const denied = await registry.deny(id, proposed.pendingActionId!)
    expect(denied).not.toHaveProperty("frozenReview")
    await expect(registry.execute(options)).rejects.toMatchObject({
      code: "CONFLICT",
    })
    expect(calls.prepare).toBe(1)
  }))

it("commit failure rolls back the edit and receipt and preserves pending approval", () =>
  run(async () => {
    const { id, coach } = await owner(),
      { registry } = fixture({ fail: true })
    const proposed = await registry.execute({
      name: operation.name,
      input: words,
      actor: coach,
      idempotencyKey: id,
    })
    await expect(
      registry.approve(id, proposed.pendingActionId!)
    ).rejects.toThrow("Commit refused")
    expect(await nameOf(id)).toBe("Ada")
    expect(await receiptCount(id)).toBe(1)
    expect(
      (
        await getDb()
          .select()
          .from(pendingActions)
          .where(eq(pendingActions.id, proposed.pendingActionId!))
      )[0]?.status
    ).toBe("pending")
  }))

it("activity-less reviewed commands retain one durable replay receipt", () =>
  run(async () => {
    const { id, person } = await owner(),
      { registry, calls } = fixture({ silent: true })
    const options = {
      name: operation.name,
      input: words,
      actor: person,
      idempotencyKey: id,
    }
    expect((await registry.execute(options)).activityId).toBeNull()
    expect((await registry.execute(options)).output).toEqual({ text: "Grace" })
    expect(calls.prepare).toBe(1)
    expect(await receiptCount(id)).toBe(1)
  }))

it.runIf(REAL)(
  "two simultaneous approvals commit once and return the same receipt",
  () =>
    run(async () => {
      const { id, coach } = await owner(),
        { registry, calls } = fixture()
      const proposed = await registry.execute({
        name: operation.name,
        input: words,
        actor: coach,
        idempotencyKey: id,
      })
      const receipts = await Promise.all([
        registry.approve(id, proposed.pendingActionId!),
        registry.approve(id, proposed.pendingActionId!),
      ])
      expect(receipts[0]?.id).toBe(receipts[1]?.id)
      expect(calls.commit).toBe(1)
      expect(await receiptCount(id)).toBe(1)
    })
)

it("a task prepares before its outer fence and cancellation during preparation prevents publication", () =>
  run(async () => {
    const task = await seedTask(inputHash)
    const [row] = await getDb()
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, task.taskId))
    const [usage] = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, task.taskId))
    const actor = coachActor(task.ownerId, row!.chatId, usage!.id)
    await getDb()
      .update(coachTasks)
      .set({
        state: "running",
        leaseOwner: "worker",
        leaseEpoch: 1,
        leaseUntil: sql`clock_timestamp() + interval '1 hour'`,
      })
      .where(eq(coachTasks.id, task.taskId))
    const { registry, calls } = fixture({
      prepare: async () => {
        await getDb()
          .update(coachTasks)
          .set({ cancelRequestedAt: sql`clock_timestamp()` })
          .where(eq(coachTasks.id, task.taskId))
      },
    })
    await expect(
      registry.executeTask(
        { taskId: task.taskId, workerId: "worker", epoch: 1 },
        {
          name: operation.name,
          input: words,
          actor,
          idempotencyKey: task.intent.intentKey,
        }
      )
    ).rejects.toThrow("Task lease lost")
    expect(calls.prepare).toBe(1)
    expect(await receiptCount(task.ownerId)).toBe(0)
    expect(
      await getDb()
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.userId, task.ownerId))
    ).toHaveLength(0)
  }))

it("task approval consumes its proposal reservation and leaves exactly one intent receipt", () =>
  run(async () => {
    const task = await seedTask(inputHash)
    const [row] = await getDb()
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, task.taskId))
    const [usage] = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, task.taskId))
    const actor = coachActor(task.ownerId, row!.chatId, usage!.id)
    await getDb()
      .update(coachTasks)
      .set({
        state: "running",
        leaseOwner: "worker",
        leaseEpoch: 1,
        leaseUntil: sql`clock_timestamp() + interval '1 hour'`,
      })
      .where(eq(coachTasks.id, task.taskId))
    const { registry, calls } = fixture()
    const proposed = await registry.executeTask(
      { taskId: task.taskId, workerId: "worker", epoch: 1 },
      {
        name: operation.name,
        input: words,
        actor,
        idempotencyKey: task.intent.intentKey,
      }
    )
    await getDb()
      .insert(toolIntents)
      .values({
        ...task.intent,
        input: words,
        inputHash: inputHash(words),
        operation: operation.name,
        taskId: task.taskId,
        state: "proposed",
        proposalId: proposed.pendingActionId,
      })
    await getDb()
      .update(coachTasks)
      .set({ state: "waitingApproval" })
      .where(eq(coachTasks.id, task.taskId))
    await registry.approve(task.ownerId, proposed.pendingActionId!)
    expect(calls.prepare).toBe(1)
    expect(calls.commit).toBe(1)
    expect(await receiptCount(task.ownerId)).toBe(1)
    expect(
      (
        await getDb()
          .select()
          .from(toolIntents)
          .where(eq(toolIntents.taskId, task.taskId))
      )[0]?.state
    ).toBe("committed")
  }))

for (const keyed of [true, false]) {
  it(`activity-less approval is atomic and replayable with keyed=${keyed}`, () =>
    run(async () => {
      const { id, coach } = await owner(),
        { registry, calls } = fixture({ silent: true })
      const proposed = await registry.execute({
        name: operation.name,
        input: words,
        actor: coach,
        ...(keyed ? { idempotencyKey: id } : {}),
      })
      expect(await registry.approve(id, proposed.pendingActionId!)).toBeNull()
      expect(await registry.approve(id, proposed.pendingActionId!)).toBeNull()
      expect(calls.prepare).toBe(1)
      expect(calls.commit).toBe(1)
      expect(await nameOf(id)).toBe("Grace")
      expect(await receiptCount(id)).toBe(1)
    }))
}

it.skipIf(!REAL)(
  "two prepared requests with one key publish the same frozen proposal",
  () =>
    run(async () => {
      const { id, coach } = await owner()
      let arrivals = 0,
        release!: () => void
      const barrier = new Promise<void>((resolve) => {
        release = resolve
      })
      const { registry, calls } = fixture({
        prepare: async () => {
          if (++arrivals === 2) release()
          await barrier
        },
      })
      const options = {
        name: operation.name,
        input: words,
        actor: coach,
        idempotencyKey: id,
      }
      const [left, right] = await Promise.all([
        registry.execute(options),
        registry.execute(options),
      ])
      expect(left.pendingActionId).toBe(right.pendingActionId)
      expect(left.review).toEqual(right.review)
      expect(calls.prepare).toBe(2)
      expect(calls.commit).toBe(0)
      expect(
        await getDb()
          .select()
          .from(pendingActions)
          .where(eq(pendingActions.userId, id))
      ).toHaveLength(1)
      expect(await receiptCount(id)).toBe(1)
    })
)

it("invalid owner and task admission refuse before staging", () =>
  run(async () => {
    const { registry, calls } = fixture()
    await expect(
      registry.execute({
        name: operation.name,
        input: words,
        actor: personActor(randomUUID()),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" })
    const task = await seedTask(inputHash)
    const [row] = await getDb()
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, task.taskId))
    const [usage] = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, task.taskId))
    await expect(
      registry.executeTask(
        { taskId: task.taskId, workerId: "wrong", epoch: 1 },
        {
          name: operation.name,
          input: words,
          actor: coachActor(task.ownerId, row!.chatId, usage!.id),
          idempotencyKey: task.intent.intentKey,
        }
      )
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(calls.prepare).toBe(0)
  }))
