import { randomUUID } from "node:crypto"
import { COACH_MODEL } from "@workspace/domain/coach"
import { coachActor, personActor } from "@workspace/domain/kernel"
import { eq, sql } from "drizzle-orm"
import { expect, it, vi } from "vitest"
import { z } from "zod"
import { getDb } from "../db/context.js"
import {
  activity,
  chats,
  chatMessages,
  coachTasks,
  coachUsage,
  jobs,
  pendingActions,
  taskEvents,
  toolIntents,
} from "../db/schema.js"
import { coachWorkerEnabledFromEnv } from "../platform/config.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import { claim, persistStep, requestCancel, runIntent } from "./task-store.js"
import { runCoachWorker } from "./worker.js"
import {
  createAnthropicModel,
  createAnthropicWorkerRuntime,
} from "./anthropic-runtime.js"
import { anthropicFixtureResponse } from "./anthropic-fixture.js"
import type { WorkerRuntime } from "./model-step.js"
import { openCoachUsage, saveRepliesForUnsavedTurns } from "./usage-store.js"
import { finishTask } from "./worker-store.js"
import {
  final,
  fixture,
  settings,
  storedRuntime,
} from "./worker-fixture.test-support.js"

it("drains accepted task claims with new durable admissions switched off", () =>
  fixture(async (_, registry) => {
    expect(coachWorkerEnabledFromEnv({})).toBe(true)
    expect(coachWorkerEnabledFromEnv({ COACH_DURABLE: "off" })).toBe(false)
    const runtime = vi.fn(storedRuntime)
    expect(
      await runCoachWorker({
        ...settings,
        env: { COACH_DURABLE: "off" },
        registry,
        runtime,
      })
    ).toBe(true)
    expect(runtime).toHaveBeenCalledTimes(1)
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "succeeded"
    )
  }))

it("runs the scripted protocol, persists ordered receipts and finalizes one canonical reply", () =>
  fixture(async ({ taskId, intent }, registry) => {
    const script = [
      {
        ...final,
        text: "Saving.",
        intents: [
          {
            id: intent.providerToolUseId,
            name: "job.create",
            input: intent.input,
          },
        ],
      },
      final,
    ]
    await getDb()
      .update(coachTasks)
      .set({ contextSnapshot: { messages: [], script } })
      .where(eq(coachTasks.id, taskId))
    expect(
      await runCoachWorker({ ...settings, registry, runtime: storedRuntime })
    ).toBe(true)
    const [task] = await getDb().select().from(coachTasks)
    expect(task?.state).toBe("succeeded")
    expect(await getDb().select().from(jobs)).toHaveLength(1)
    expect(await getDb().select().from(activity)).toHaveLength(1)
    const [message] = await getDb().select().from(chatMessages)
    expect(message?.text).toBe("Saving.Saved.")
    expect(JSON.stringify(message?.parts)).toContain('"activityId"')
    expect((await getDb().select().from(coachUsage))[0]?.messageId).toBe(
      task?.assistantMessageId
    )
    await finishTask(
      { taskId, workerId: "worker", epoch: task!.leaseEpoch },
      "succeeded",
      registry
    )
    expect(await getDb().select().from(chatMessages)).toHaveLength(1)
    const events = await getDb()
      .select()
      .from(taskEvents)
      .orderBy(taskEvents.seq)
    expect(events.map((row) => row.seq)).toEqual(
      events.map((_, index) => index)
    )
    expect(events.filter((row) => row.logicalKey === "terminal")).toHaveLength(
      1
    )
  }))

it("restores a saved script after process loss and reuses a committed receipt before inference", () =>
  fixture(async ({ taskId, intent }, registry) => {
    const script = [
      {
        ...final,
        text: "Saving.",
        intents: [
          {
            id: intent.providerToolUseId,
            name: "job.create",
            input: intent.input,
          },
        ],
      },
      final,
    ]
    await getDb()
      .update(coachTasks)
      .set({ contextSnapshot: { messages: [], script } })
      .where(eq(coachTasks.id, taskId))
    const { lease } = (await claim({
      workerId: "lost-process",
      leaseMs: 60000,
    }))!
    await persistStep(
      lease,
      {
        completedStep: 0,
        phase: "decision",
        modelMessages: [
          {
            role: "assistant",
            content: [
              { type: "text", text: "Saving." },
              {
                type: "tool_use",
                id: intent.providerToolUseId,
                name: "job_create",
                input: intent.input,
              },
            ],
          },
        ],
        usage: { inputTokens: 2, outputTokens: 3 },
        observedRevisions: [],
        requestManifest: {},
      },
      [intent]
    )
    const receipt = await runIntent(lease, intent, registry)
    await getDb()
      .update(coachTasks)
      .set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(coachTasks.id, taskId))
    await runCoachWorker({ ...settings, registry, runtime: storedRuntime })
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "succeeded"
    )
    expect((await getDb().select().from(toolIntents))[0]?.publicResult).toEqual(
      receipt
    )
    expect(await getDb().select().from(jobs)).toHaveLength(1)
    expect(await getDb().select().from(activity)).toHaveLength(1)
    expect(
      (await getDb().select().from(taskEvents)).filter(
        (row) => row.kind === "attemptRestarted"
      )
    ).toHaveLength(1)
  }))

it("Stop cancels a paused task durably and blocks approval without using a local controller", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    const [task] = await getDb().select().from(coachTasks)
    await getDb()
      .update(coachTasks)
      .set({ state: "waitingApproval" })
      .where(eq(coachTasks.id, taskId))
    const result = await registry.execute({
      name: "coach.stop",
      input: { chatId: task!.chatId, taskId },
      actor: personActor(ownerId),
    })
    expect(result.output).toEqual({ stopped: true })
    await runCoachWorker({ ...settings, registry, runtime: storedRuntime })
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "cancelled"
    )
  }))

it.each(["steps", "tokens", "deadline", "catalog"])(
  "enforces persisted %s before effects",
  (budget) =>
    fixture(async ({ taskId, intent }, registry) => {
      const script = [
        {
          ...final,
          intents: [
            {
              id: intent.providerToolUseId,
              name: "job.create" as const,
              input: intent.input,
            },
          ],
        },
        final,
      ]
      await getDb()
        .update(coachTasks)
        .set({
          contextSnapshot: { messages: [], script },
          ...(budget === "steps" ? { maxSteps: 1 } : {}),
          ...(budget === "tokens" ? { maxTokens: 1 } : {}),
          ...(budget === "deadline"
            ? { deadlineAt: sql`clock_timestamp() - interval '1 second'` }
            : {}),
          ...(budget === "catalog" ? { catalogDigest: "unavailable" } : {}),
        })
        .where(eq(coachTasks.id, taskId))
      await runCoachWorker({ ...settings, registry, runtime: storedRuntime })
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe("failed")
      expect(await getDb().select().from(jobs)).toHaveLength(
        budget === "steps" ? 1 : 0
      )
    })
)

it("cancels a streaming provider on renewal and preserves no partial canonical text", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    let renew!: () => Promise<void>, entered!: () => void
    const ready = new Promise<void>((resolve) => {
      entered = resolve
    })
    const runtime: WorkerRuntime = async function* (input) {
      yield { type: "text-delta", text: "Incomplete" }
      entered()
      await new Promise<void>((resolve) =>
        input.signal.addEventListener("abort", () => resolve(), { once: true })
      )
      input.signal.throwIfAborted()
    }
    const work = runCoachWorker({
      ...settings,
      registry,
      runtime: () => runtime,
      scheduleRenewal: (tick) => {
        renew = tick
        return () => {}
      },
    })
    await ready
    await requestCancel(taskId, ownerId)
    await renew()
    await work
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "cancelled"
    )
    expect((await getDb().select().from(chatMessages))[0]?.text).toBe("")
  }))

it("uses the Anthropic Tool Runner through the durable boundary with transport fixtures only", () =>
  fixture(async ({ ownerId, taskId }, registry) => {
    await getDb()
      .update(coachTasks)
      .set({ modelId: COACH_MODEL })
      .where(eq(coachTasks.id, taskId))
    const [task] = await getDb().select().from(coachTasks)
    const requests: unknown[] = []
    const responses = [
      anthropicFixtureResponse([
        {
          type: "tool-call",
          toolCallId: "create",
          toolName: "job_create",
          input: JSON.stringify({ title: "Engineer", company: "Acme" }),
        },
      ]),
      anthropicFixtureResponse([{ type: "text-delta", delta: "Done." }]),
    ]
    const model = createAnthropicModel({
      apiKey: "fixture",
      maxRetries: 0,
      fetch: async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)))
        const response = responses.shift()
        if (!response) throw new Error("Unexpected model request")
        return response
      },
    })
    const entries = await registry.tools(
      coachActor(ownerId, task!.chatId, "fixture")
    )
    await runCoachWorker({
      ...settings,
      registry,
      runtime: () =>
        createAnthropicWorkerRuntime({
          model,
          system: "Grounded",
          history: [],
          entries,
          registry,
          actor: coachActor(ownerId, task!.chatId, "fixture"),
        }),
    })
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "succeeded"
    )
    expect((await getDb().select().from(chatMessages))[0]?.text).toBe("Done.")
    expect(await getDb().select().from(jobs)).toHaveLength(1)
    expect(requests).toHaveLength(2)
    expect(JSON.stringify(requests[1])).toContain('"tool_use_id":"create"')
  }))

it("holds automatic intents after the first proposal and resumes in saved order", () =>
  fixture(async ({ taskId, ownerId, intent }, registry) => {
    const created = await registry.execute({
      name: "job.create",
      input: { title: "Role", company: "Acme" },
      actor: personActor(ownerId),
    })
    const jobId = z.object({ id: z.string() }).parse(created.output).id
    const script = [
      {
        ...final,
        intents: [
          { id: "delete", name: "job.delete" as const, input: { jobId } },
          { id: "create", name: "job.create" as const, input: intent.input },
        ],
      },
      final,
    ]
    const runtime = () => createScriptedWorkerRuntime(script)
    await runCoachWorker({ ...settings, registry, runtime })
    expect(
      (await getDb().select().from(toolIntents).orderBy(toolIntents.slot)).map(
        (row) => row.state
      )
    ).toEqual(["proposed", "planned"])
    expect(await getDb().select().from(jobs)).toHaveLength(1)
    const [proposal] = await getDb().select().from(pendingActions)
    await registry.deny(ownerId, proposal!.id)
    await runCoachWorker({ ...settings, registry, runtime })
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "succeeded"
    )
    expect(await getDb().select().from(jobs)).toHaveLength(2)
    expect((await getDb().select().from(chatMessages))[0]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool", ok: false }),
      ])
    )
    expect(taskId).toBe(proposal?.coachTaskId)
  }))

it("bounds transient retries durably without admitting effects", () =>
  fixture(async ({ taskId }, registry) => {
    const runtime: WorkerRuntime = async function* () {
      yield { type: "text-delta", text: "Unacknowledged draft" }
      throw Object.assign(new Error("Unavailable"), { status: 503 })
    }
    for (const retryCount of [1, 2]) {
      await runCoachWorker({ ...settings, registry, runtime: () => runtime })
      expect((await getDb().select().from(coachTasks))[0]).toMatchObject({
        state: "queued",
        leaseOwner: null,
        retryCount,
      })
      await getDb()
        .update(coachTasks)
        .set({ availableAt: sql`clock_timestamp()` })
        .where(eq(coachTasks.id, taskId))
    }
    await runCoachWorker({ ...settings, registry, runtime: () => runtime })
    expect((await getDb().select().from(coachTasks))[0]).toMatchObject({
      state: "failed",
      retryCount: 2,
    })
    expect((await getDb().select().from(chatMessages))[0]?.text).toBe("")
    expect(await getDb().select().from(activity)).toHaveLength(0)
  }))

it("keeps active tasks out of legacy admission and reply recovery after five minutes", () =>
  fixture(async ({ taskId, ownerId, intent }, registry) => {
    const { lease } = (await claim({ workerId: "lost", leaseMs: 60000 }))!
    await persistStep(
      lease,
      {
        completedStep: 0,
        phase: "decision",
        modelMessages: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        observedRevisions: [],
        requestManifest: {},
      },
      [intent]
    )
    await runIntent(lease, intent, registry)
    await getDb()
      .update(coachUsage)
      .set({ createdAt: sql`clock_timestamp() - interval '10 minutes'` })
      .where(eq(coachUsage.coachTaskId, taskId))
    const [task] = await getDb().select().from(coachTasks)
    await saveRepliesForUnsavedTurns({ userId: ownerId, chatId: task!.chatId })
    expect(await getDb().select().from(chatMessages)).toHaveLength(0)
    await expect(
      openCoachUsage({
        userId: ownerId,
        chatId: task!.chatId,
        plan: "free",
        mode: "free",
        provider: "fake",
        model: "fake",
      })
    ).rejects.toThrow("already working")
  }))

it.each(["New chat", "My own title"])(
  "finalization preserves the eligible title rule for %s",
  (title) =>
    fixture(async ({ taskId }, registry) => {
      const [task] = await getDb().select().from(coachTasks)
      await getDb()
        .update(chats)
        .set({ title })
        .where(eq(chats.id, task!.chatId))
      await getDb().insert(chatMessages).values({
        id: randomUUID(),
        chatId: task!.chatId,
        role: "person",
        text: "Help me prepare for interviews",
        parts: [],
      })
      await runCoachWorker({ ...settings, registry, runtime: storedRuntime })
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "succeeded"
      )
      expect((await getDb().select().from(chats))[0]?.title).toBe(
        title === "New chat" ? "Prepare for interviews" : title
      )
      expect(taskId).toBe(task?.id)
    })
)

it("uses task step progress independently of historic assistant messages", () =>
  fixture(async ({ taskId, intent }, registry) => {
    const script = [
      {
        ...final,
        intents: [
          { id: "create", name: "job.create" as const, input: intent.input },
        ],
      },
      final,
    ]
    await getDb()
      .update(coachTasks)
      .set({
        contextSnapshot: {
          messages: [
            { role: "user", content: "Earlier" },
            { role: "assistant", content: "Historic response" },
          ],
          script,
        },
      })
      .where(eq(coachTasks.id, taskId))
    await runCoachWorker({ ...settings, registry, runtime: storedRuntime })
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "succeeded"
    )
    expect(await getDb().select().from(jobs)).toHaveLength(1)
  }))
