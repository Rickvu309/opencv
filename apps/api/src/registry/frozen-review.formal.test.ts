import { randomUUID } from "node:crypto"
import { coachActor, personActor } from "@workspace/domain/kernel"
import { eq } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"
import { getDb, transaction } from "../db/context.js"
import {
  activity,
  coachTasks,
  coachUsage,
  pendingActions,
  user,
} from "../db/schema.js"
import { seedTask } from "../test/coach-task-support.js"
import { registerBackendHooks, REAL } from "../test/registry-formal-support.js"
import {
  candidate,
  fixture,
  nameOf,
  operation,
  owner,
  receiptCount,
  review,
  run,
  words,
  type Input,
} from "../test/frozen-review-support.js"
import { inputHash } from "./receipt.js"

registerBackendHooks()

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
