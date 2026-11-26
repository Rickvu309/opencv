import { randomUUID } from "node:crypto"
import { delegateActorSchema } from "@workspace/domain/kernel"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"
import { runIntent } from "../coach/index.js"
import { getDb, transaction } from "../db/context.js"
import {
  activity,
  coachTasks,
  pendingActions,
  taskEvents,
  toolIntents,
  user,
} from "../db/schema.js"
import { seedTask } from "../test/coach-task-support.js"
import {
  fixture,
  nameOf,
  operation,
  owner,
  receiptCount,
  run,
  undoFixture,
  words,
} from "../test/frozen-review-support.js"
import { inputHash } from "./receipt.js"
import { registerBackendHooks } from "../test/registry-formal-support.js"
import { Registry } from "./registry.js"

registerBackendHooks()

const select = (input: { legacy?: boolean }) =>
  input.legacy ? "execute" : "reviewed"

it("one name selects the normalized legacy executor and keeps its keyed identity", () =>
  run(async () => {
    const actor = await owner(),
      { registry, calls } = fixture({ select })
    const options = {
      name: operation.name,
      input: { ...words, after: " Grace ", legacy: true },
      actor: actor.person,
      idempotencyKey: randomUUID(),
    }
    const first = await registry.execute(options)
    expect(first.output).toEqual({ text: "Grace" })
    expect(
      await registry.execute({ ...options, input: { ...words, legacy: true } })
    ).toMatchObject({ activityId: first.activityId })
    expect(calls.execute).toBe(1)
    expect(calls.prepare).toBe(0)
    expect(calls.commit).toBe(0)
    expect(registry.commandNames()).toEqual([operation.name])
    expect(registry.list().commands.map((command) => command.name)).toEqual([
      operation.name,
    ])
    await expect(
      registry.execute({ ...options, input: words })
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(await receiptCount(actor.id)).toBe(1)
    expect(await nameOf(actor.id)).toBe("Grace")
  }))

it("a person selected review commits the frozen candidate once", () =>
  run(async () => {
    const actor = await owner(),
      { registry, calls } = fixture({ select })
    const committed = await registry.execute({
      name: operation.name,
      input: words,
      actor: actor.person,
      idempotencyKey: randomUUID(),
    })
    expect(committed).toMatchObject({
      pending: false,
      output: { text: "Grace" },
    })
    expect(calls.prepare).toBe(1)
    expect(calls.commit).toBe(1)
    expect(calls.execute).toBe(0)
    expect(await nameOf(actor.id)).toBe("Grace")
    expect(
      await getDb()
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.userId, actor.id))
    ).toHaveLength(0)
  }))

it("the selected reviewed branch freezes once and approval commits that candidate once", () =>
  run(async () => {
    const actor = await owner(),
      { registry, calls } = fixture({ select })
    const options = {
      name: operation.name,
      input: words,
      actor: actor.coach,
      idempotencyKey: randomUUID(),
    }
    const proposed = await registry.execute(options)
    expect(proposed.pending).toBe(true)
    expect(await nameOf(actor.id)).toBe("Ada")
    expect(await registry.execute(options)).toMatchObject({
      pendingActionId: proposed.pendingActionId,
    })
    expect(calls.prepare).toBe(1)
    const approved = await registry.approve(actor.id, proposed.pendingActionId!)
    expect(await registry.approve(actor.id, proposed.pendingActionId!)).toEqual(
      approved
    )
    expect(await registry.execute(options)).toMatchObject({
      activityId: approved?.id,
    })
    expect(calls.prepare).toBe(1)
    expect(calls.commit).toBe(1)
    expect(calls.execute).toBe(0)
    expect(await nameOf(actor.id)).toBe("Grace")
  }))

it("a saved review cannot downgrade to the legacy executor on approval or keyed replay", () =>
  run(async () => {
    let selected: "execute" | "reviewed" = "reviewed"
    const actor = await owner(),
      { registry, calls } = fixture({ select: () => selected })
    const options = {
      name: operation.name,
      input: words,
      actor: actor.coach,
      idempotencyKey: randomUUID(),
    }
    const proposed = await registry.execute(options)
    selected = "execute"
    await expect(
      registry.approve(actor.id, proposed.pendingActionId!)
    ).rejects.toMatchObject({ code: "CONFLICT" })
    await expect(registry.execute(options)).rejects.toMatchObject({
      code: "CONFLICT",
    })
    expect(calls.execute).toBe(0)
    expect(calls.commit).toBe(0)
    expect(await nameOf(actor.id)).toBe("Ada")
    expect(
      (
        await getDb()
          .select()
          .from(pendingActions)
          .where(eq(pendingActions.userId, actor.id))
      )[0]?.status
    ).toBe("pending")
  }))

it.each(["person", "coach"] as const)(
  "a %s unchanged edit has one terminal receipt and no proposal, effect or Undo",
  (kind) =>
    run(async () => {
      const actor = await owner(),
        { registry, calls } = fixture({ select, unchanged: true })
      const options = {
        name: operation.name,
        input: { before: "Ada", after: " Ada " },
        actor: actor[kind],
        idempotencyKey: randomUUID(),
      }
      const result = await registry.execute(options)
      expect(result).toMatchObject({
        pending: false,
        output: { text: "Ada" },
        activityId: null,
      })
      expect(await registry.execute(options)).toMatchObject({
        output: { text: "Ada" },
        pending: false,
      })
      expect(calls.prepare).toBe(1)
      expect(calls.revalidate).toBe(1)
      expect(calls.commit).toBe(0)
      expect(calls.execute).toBe(0)
      expect(await receiptCount(actor.id)).toBe(1)
      expect(
        await getDb()
          .select()
          .from(activity)
          .where(eq(activity.userId, actor.id))
      ).toHaveLength(0)
      expect(
        await getDb()
          .select()
          .from(pendingActions)
          .where(eq(pendingActions.userId, actor.id))
      ).toHaveLength(0)
      expect(await nameOf(actor.id)).toBe("Ada")
    })
)

it("an unchanged snapshot that drifts before publication refuses without a receipt", () =>
  run(async () => {
    const actor = await owner()
    const { registry, calls } = fixture({
      select,
      unchanged: true,
      prepare: async () => {
        await getDb()
          .update(user)
          .set({ name: "Later typing" })
          .where(eq(user.id, actor.id))
      },
    })
    await expect(
      registry.execute({
        name: operation.name,
        input: { before: "Ada", after: "Ada" },
        actor: actor.person,
        idempotencyKey: randomUUID(),
      })
    ).rejects.toThrow("Basis conflict")
    expect(calls.commit).toBe(0)
    expect(await receiptCount(actor.id)).toBe(0)
    expect(await nameOf(actor.id)).toBe("Later typing")
  }))

it("selected reviewed preparation refuses an outer SQL transaction while the legacy branch remains SQL-local", () =>
  run(async () => {
    const actor = await owner(),
      { registry, calls } = fixture({ select })
    await expect(
      transaction(() =>
        registry.execute({
          name: operation.name,
          input: words,
          actor: actor.person,
        })
      )
    ).rejects.toThrow("preparation must start")
    expect(calls.prepare).toBe(0)
    await transaction(() =>
      registry.execute({
        name: operation.name,
        input: { ...words, legacy: true },
        actor: actor.person,
      })
    )
    expect(calls.execute).toBe(1)
    expect(await nameOf(actor.id)).toBe("Grace")
  }))

it("only owned receipt Undo admits a hidden restore; people and both agent transports cannot name it", () =>
  run(async () => {
    const actor = await owner(),
      other = await owner(),
      { registry, restore, restores } = undoFixture()
    const delegate = delegateActorSchema.parse({
      type: "delegate",
      userId: actor.id,
      connectionId: randomUUID(),
      name: "MCP",
      scopes: ["job.read", "job.write"],
      resources: "jobs",
      reads: "allow",
      writes: "approval",
    })
    for (const identity of [actor.person, actor.coach, delegate]) {
      expect(
        (await registry.tools(identity)).map((tool) => tool.name)
      ).not.toContain(restore)
      await expect(
        registry.execute({
          name: restore,
          input: { expected: "Grace", prior: "Ada" },
          actor: identity,
          idempotencyKey: randomUUID(),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    }
    expect(registry.commandNames()).not.toContain(restore)
    expect(
      registry.list().commands.map((command) => command.name)
    ).not.toContain(restore)
    expect(registry.taskCanPrepare(restore)).toBe(false)
    const done = await registry.execute({
      name: "fixture.write",
      input: words,
      actor: actor.person,
      idempotencyKey: randomUUID(),
    })
    await expect(registry.undo(other.id, done.activityId!)).rejects.toThrow()
    expect(restores()).toBe(0)
    await registry.undo(actor.id, done.activityId!)
    expect(await nameOf(actor.id)).toBe("Ada")
    expect(restores()).toBe(1)
    await expect(
      registry.undo(actor.id, done.activityId!)
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(restores()).toBe(1)
  }))

it("private restore failure rolls back text and receipt status; retry uses the same owned receipt", () =>
  run(async () => {
    let fail = true
    const actor = await owner(),
      { registry, restores } = undoFixture(() => fail)
    const done = await registry.execute({
      name: "fixture.write",
      input: words,
      actor: actor.person,
      idempotencyKey: randomUUID(),
    })
    await expect(registry.undo(actor.id, done.activityId!)).rejects.toThrow(
      "Restore refused"
    )
    expect(await nameOf(actor.id)).toBe("Grace")
    expect(
      (
        await getDb()
          .select()
          .from(activity)
          .where(eq(activity.id, done.activityId!))
      )[0]?.undoneAt
    ).toBeNull()
    fail = false
    await registry.undo(actor.id, done.activityId!)
    expect(await nameOf(actor.id)).toBe("Ada")
    expect(restores()).toBe(2)
  }))

it("private Undo refuses after later typing and leaves the receipt live", () =>
  run(async () => {
    const actor = await owner(),
      { registry } = undoFixture()
    const done = await registry.execute({
      name: "fixture.write",
      input: words,
      actor: actor.person,
      idempotencyKey: randomUUID(),
    })
    await getDb()
      .update(user)
      .set({ name: "Later typing" })
      .where(eq(user.id, actor.id))
    await expect(registry.undo(actor.id, done.activityId!)).rejects.toThrow(
      "The name changed"
    )
    expect(await nameOf(actor.id)).toBe("Later typing")
    expect(
      (
        await getDb()
          .select()
          .from(activity)
          .where(eq(activity.id, done.activityId!))
      )[0]?.undoneAt
    ).toBeNull()
  }))

it("a coach and a delegate cannot approve or undo, and the person still can", () =>
  run(async () => {
    const actor = await owner()
    const registry = new Registry()
    let calls = 0
    const handler = async () => {
      calls += 1
      return { ok: true }
    }
    for (const name of ["actions.approve", "activity.undo"]) {
      registry.addCommand(
        {
          name,
          description: "Person control",
          input: z.object({}).strict(),
          coach: "never",
          destructive: false,
          step: () => "Person control",
          reversal: () => null,
          activity: () => null,
        },
        handler
      )
    }
    const delegate = delegateActorSchema.parse({
      type: "delegate",
      userId: actor.id,
      connectionId: randomUUID(),
      name: "MCP",
      scopes: ["job.read", "job.write"],
      resources: "jobs",
      reads: "allow",
      writes: "approval",
    })
    for (const name of ["actions.approve", "activity.undo"]) {
      expect(
        (await registry.tools(actor.coach)).map((tool) => tool.name)
      ).not.toContain(name)
      expect(
        (await registry.tools(delegate)).map((tool) => tool.name)
      ).not.toContain(name)
      await expect(
        registry.execute({
          name,
          input: {},
          actor: actor.coach,
          idempotencyKey: randomUUID(),
        })
      ).rejects.toMatchObject({ code: "COACH_NOT_ALLOWED" })
      await expect(
        registry.execute({
          name,
          input: {},
          actor: delegate,
          idempotencyKey: randomUUID(),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    }
    expect(calls).toBe(0)
    await registry.execute({
      name: "activity.undo",
      input: {},
      actor: actor.person,
      idempotencyKey: randomUUID(),
    })
    expect(calls).toBe(1)
    expect(registry.commandNames()).toEqual([
      "actions.approve",
      "activity.undo",
    ])
  }))

async function selectedTask(input: {
  before: string
  after: string
  legacy?: boolean
}) {
  const task = await seedTask(inputHash)
  const intent = {
    ...task.intent,
    input,
    inputHash: inputHash(input),
    operation: operation.name,
  }
  await getDb()
    .insert(toolIntents)
    .values({ ...intent, taskId: task.taskId, state: "planned" })
  await getDb()
    .update(coachTasks)
    .set({
      state: "running",
      leaseOwner: "worker",
      leaseEpoch: 1,
      leaseUntil: sql`clock_timestamp() + interval '1 hour'`,
    })
    .where(eq(coachTasks.id, task.taskId))
  return {
    ...task,
    intent,
    lease: { taskId: task.taskId, workerId: "worker", epoch: 1 },
  }
}

it("the worker keeps a selected direct edit pending and does not prepare or run it", () =>
  run(async () => {
    const task = await selectedTask({ ...words, legacy: true })
    const { registry, calls } = fixture({ select })
    const proposed = await runIntent(task.lease, task.intent, registry)
    expect(proposed).toMatchObject({ pending: true })
    expect(calls.prepare).toBe(0)
    expect(calls.execute).toBe(0)
    expect(calls.commit).toBe(0)
    expect(await nameOf(task.ownerId)).toBe("Ada")
    expect(
      await getDb()
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.userId, task.ownerId))
    ).toHaveLength(1)
    expect(
      (
        await getDb()
          .select()
          .from(toolIntents)
          .where(eq(toolIntents.taskId, task.taskId))
      )[0]?.state
    ).toBe("proposed")
  }))

it("the worker prepares a selected review once and leaves it pending until the person approves", () =>
  run(async () => {
    const task = await selectedTask(words)
    const { registry, calls } = fixture({ select })
    const proposed = z
      .object({ pendingActionId: z.string() })
      .parse(await runIntent(task.lease, task.intent, registry))
    expect(calls.prepare).toBe(1)
    expect(calls.commit).toBe(0)
    expect(calls.execute).toBe(0)
    expect(
      (
        await getDb()
          .select()
          .from(toolIntents)
          .where(eq(toolIntents.taskId, task.taskId))
      )[0]?.state
    ).toBe("proposed")
    await registry.approve(task.ownerId, proposed.pendingActionId)
    expect(calls.prepare).toBe(1)
    expect(calls.commit).toBe(1)
    expect(await nameOf(task.ownerId)).toBe("Grace")
  }))

it("the worker publishes one unchanged receipt, and lease loss rolls the receipt, intent and event back together", () =>
  run(async () => {
    const input = { before: "Ada", after: "Ada" }
    const task = await selectedTask(input)
    const { registry, calls } = fixture({
      select,
      unchanged: true,
      revalidate: async () => {
        await getDb()
          .update(coachTasks)
          .set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` })
          .where(eq(coachTasks.id, task.taskId))
      },
    })
    await expect(runIntent(task.lease, task.intent, registry)).rejects.toThrow(
      "Task lease lost"
    )
    expect(calls.prepare).toBe(1)
    expect(calls.revalidate).toBe(1)
    expect(calls.commit).toBe(0)
    expect(await receiptCount(task.ownerId)).toBe(0)
    expect(
      await getDb()
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.userId, task.ownerId))
    ).toHaveLength(0)
    expect(
      await getDb()
        .select()
        .from(taskEvents)
        .where(eq(taskEvents.taskId, task.taskId))
    ).toHaveLength(0)
    expect(
      (
        await getDb()
          .select()
          .from(toolIntents)
          .where(eq(toolIntents.taskId, task.taskId))
      )[0]?.state
    ).toBe("planned")
    const retried = fixture({ select, unchanged: true })
    expect(
      await runIntent(task.lease, task.intent, retried.registry)
    ).toMatchObject({ pending: false, output: { text: "Ada" } })
    expect(retried.calls.prepare).toBe(1)
    expect(retried.calls.revalidate).toBe(1)
    expect(retried.calls.commit).toBe(0)
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
