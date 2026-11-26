import { randomUUID } from "node:crypto"

import {
  coachActor,
  parseChatId,
  parseUserId,
  personActor,
} from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { asc, eq } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"

import { getChat } from "./chat/index.js"
import { getDb } from "../db/context.js"
import {
  activity,
  coachTasks,
  coachUsage,
  paperDocs,
  toolIntents,
  user,
} from "../db/schema.js"
import type { Registry } from "../registry/registry.js"
import { createTaskRuntime } from "./task-runtime.js"
import { fixture, settings } from "./worker-fixture.test-support.js"
import { runCoachWorker } from "./worker.js"

const startedSchema = z.object({
  output: z.object({
    docId: z.string(),
    name: z.string(),
    kind: z.enum(["cv", "letter"]),
  }),
})

const jobLinksSchema = z
  .object({
    cvDocId: z.string().nullable(),
    letterDocId: z.string().nullable(),
  })
  .passthrough()

async function jobFor(registry: Registry, ownerId: string, company: string) {
  const created = await registry.execute({
    name: "job.create",
    input: { title: "Product designer", company },
    actor: personActor(ownerId),
  })
  return z.object({ id: z.string() }).parse(created.output).id
}

async function linksOf(registry: Registry, ownerId: string, jobId: string) {
  return jobLinksSchema.parse(
    await registry.read("job.get", { jobId }, personActor(ownerId))
  )
}

async function papersOf(ownerId: string) {
  return getDb()
    .select({ docId: paperDocs.id })
    .from(paperDocs)
    .where(eq(paperDocs.userId, ownerId))
}

async function outlineOf(registry: Registry, ownerId: string, docId: string) {
  return z
    .object({ outline: z.string(), revision: z.number() })
    .parse(
      await registry.read("paper.outline", { docId }, personActor(ownerId))
    )
}

async function createTurn(
  registry: Registry,
  ownerId: string,
  taskId: string,
  context: Record<string, unknown>
) {
  await getDb()
    .update(coachTasks)
    .set({ contextSnapshot: context })
    .where(eq(coachTasks.id, taskId))
  const runtime: Parameters<typeof runCoachWorker>[0]["runtime"] = (task) =>
    createTaskRuntime(task, registry)
  await runCoachWorker({ ...settings, registry, runtime })
  const [asked] = await getDb().select().from(toolIntents)
  expect([asked?.operation, asked?.state]).toEqual(["paper.start", "proposed"])
  expect(await registry.read("paper.list", {}, personActor(ownerId))).toEqual(
    []
  )
  await registry.approve(ownerId, asked!.proposalId!)
  await runCoachWorker({ ...settings, registry, runtime })
  const [waiting] = await getDb().select().from(coachTasks)
  expect(waiting?.state).toBe("waitingApproval")
  const intents = await getDb()
    .select()
    .from(toolIntents)
    .orderBy(asc(toolIntents.step))
  expect(intents.map((intent) => [intent.operation, intent.state])).toEqual([
    ["paper.start", "committed"],
    ["paper.outline", "read"],
    ["paper.edit", "proposed"],
  ])
  const started = startedSchema.parse(intents[0]!.publicResult).output
  const before = await outlineOf(registry, ownerId, started.docId)
  await registry.approve(ownerId, intents[2]!.proposalId!)
  await runCoachWorker({ ...settings, registry, runtime })
  const [finished] = await getDb().select().from(coachTasks)
  expect(finished?.state).toBe("succeeded")
  const after = await outlineOf(registry, ownerId, started.docId)
  expect(after.outline).toContain("Reviewed by the Coach.")
  const parts = (
    await getChat(parseUserId(ownerId), parseChatId(finished!.chatId))
  ).messages
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "tool")
  expect(parts.map((part) => part.name)).toEqual(
    expect.arrayContaining(["paper.start", "paper.edit"])
  )
  const edit = parts.find((part) => part.name === "paper.edit")
  expect(edit).toMatchObject({ outcome: "approved" })
  await registry.undo(ownerId, edit!.activityId!)
  const undone = await outlineOf(registry, ownerId, started.docId)
  expect(undone.outline).toBe(before.outline)
  return { started, before }
}

it("a CV the Coach starts is a Paper it reads, edits with approval and Undo", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    const { started, before } = await createTurn(registry, ownerId, taskId, {
      messages: [{ role: "user", content: "Make me a CV" }],
    })
    expect(started).toMatchObject({ kind: "cv", name: "Simple CV" })
    expect(before.outline).toContain("[Your name]")
    expect(before.outline).toContain("[Role, company] | [Dates]")
    const papers = z
      .array(z.object({ id: z.string() }).passthrough())
      .parse(
        await registry.read(
          "paper.list",
          { writer: RICH_NATIVE_WRITER },
          personActor(ownerId)
        )
      )
    expect(papers.map((paper) => paper.id)).toEqual([started.docId])
  }))

it("a Letter the Coach starts for a Job is a blank Paper named for the Job", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    const jobId = await jobFor(registry, ownerId, "Lumiere")
    const { started, before } = await createTurn(registry, ownerId, taskId, {
      messages: [
        { role: "user", content: "Start a cover letter for this Job" },
      ],
      context: [{ kind: "job", id: jobId }],
    })
    expect(started).toMatchObject({
      kind: "letter",
      name: "Cover letter, Lumiere",
    })
    expect(
      (JSON.parse(before.outline) as { content: unknown[] }[]).every(
        (node) => node.content.length === 0
      )
    ).toBe(true)
    expect(before.outline).not.toContain("[Your name]")
    const [start] = await getDb()
      .select()
      .from(toolIntents)
      .orderBy(asc(toolIntents.step))
    expect(start?.input).toEqual({ kind: "letter", jobId })
    expect(await linksOf(registry, ownerId, jobId)).toMatchObject({
      letterDocId: started.docId,
      linked: { letter: { id: started.docId, name: started.name } },
    })
  }))

it("a page started for a Job links to it, and the same key twice makes one page and one link", () =>
  fixture(async ({ ownerId }, registry) => {
    const actor = personActor(ownerId)
    const jobId = await jobFor(registry, ownerId, "Northwind")
    const idempotencyKey = randomUUID()
    const start = () =>
      registry.execute({
        name: "paper.start",
        input: { kind: "cv", jobId },
        actor,
        idempotencyKey,
      })
    const first = startedSchema.parse(await start()).output
    const again = startedSchema.parse(await start()).output
    expect(again.docId).toBe(first.docId)
    expect(first.name).toBe("Simple CV, Northwind")
    expect(await papersOf(ownerId)).toEqual([{ docId: first.docId }])
    expect(await linksOf(registry, ownerId, jobId)).toMatchObject({
      cvDocId: first.docId,
      letterDocId: null,
      linked: { cv: { id: first.docId } },
    })
    const receipts = await getDb()
      .select({ summary: activity.summary })
      .from(activity)
      .where(eq(activity.userId, ownerId))
    expect(
      receipts.filter((row) => row.summary.startsWith("You linked"))
    ).toHaveLength(1)
  }))

it("refuses another person's Job the same as an unknown Job and makes no page", () =>
  fixture(async ({ ownerId }, registry) => {
    const strangerId = randomUUID()
    await getDb()
      .insert(user)
      .values({
        id: strangerId,
        name: strangerId,
        email: `${strangerId}@test.invalid`,
      })
    const jobId = await jobFor(registry, ownerId, "Fabrikam")
    const refusal = (target: string) =>
      registry
        .execute({
          name: "paper.start",
          input: { kind: "letter", jobId: target },
          actor: personActor(strangerId),
          idempotencyKey: randomUUID(),
        })
        .then(
          () => null,
          (error: { code?: string; message?: string }) => [
            error.code,
            error.message,
          ]
        )
    const foreign = await refusal(jobId)
    expect(foreign).not.toBeNull()
    expect(foreign).toEqual(await refusal(randomUUID()))
    expect(await papersOf(strangerId)).toEqual([])
    expect(await linksOf(registry, ownerId, jobId)).toMatchObject({
      cvDocId: null,
      letterDocId: null,
    })
  }))

it("makes no page when the Job is gone by the time the person approves it", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    const jobId = await jobFor(registry, ownerId, "Contoso")
    await getDb()
      .update(coachTasks)
      .set({
        contextSnapshot: {
          messages: [{ role: "user", content: "Start a cover letter" }],
          context: [{ kind: "job", id: jobId }],
        },
      })
      .where(eq(coachTasks.id, taskId))
    const runtime: Parameters<typeof runCoachWorker>[0]["runtime"] = (task) =>
      createTaskRuntime(task, registry)
    await runCoachWorker({ ...settings, registry, runtime })
    const [asked] = await getDb().select().from(toolIntents)
    expect([asked?.operation, asked?.state]).toEqual([
      "paper.start",
      "proposed",
    ])
    await registry.execute({
      name: "job.delete",
      input: { jobId },
      actor: personActor(ownerId),
    })
    await registry.approve(ownerId, asked!.proposalId!).catch(() => null)
    await runCoachWorker({ ...settings, registry, runtime }).catch(() => null)
    expect(await papersOf(ownerId)).toEqual([])
    const [after] = await getDb()
      .select()
      .from(toolIntents)
      .where(eq(toolIntents.operation, "paper.start"))
    expect(after?.state).not.toBe("committed")
  }))

it("offers the Coach paper_start and never the older block create or typing", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    const [task] = await getDb()
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, taskId))
    const [usage] = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, taskId))
    const names = (
      await registry.tools(coachActor(ownerId, task!.chatId, usage!.id))
    ).map((tool) => tool.name)
    expect(names).toContain("paper.start")
    expect(names).toContain("paper.edit")
    expect(names).not.toContain("paper.create")
  }))

it("never starts a page in a text-only turn, even when the words ask for one", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    await getDb()
      .update(coachTasks)
      .set({ toolsAllowed: false })
      .where(eq(coachTasks.id, taskId))
    await getDb()
      .update(coachTasks)
      .set({
        contextSnapshot: {
          messages: [{ role: "user", content: "Make me a CV" }],
        },
      })
      .where(eq(coachTasks.id, taskId))
    const runtime: Parameters<typeof runCoachWorker>[0]["runtime"] = (task) =>
      createTaskRuntime(task, registry)
    await runCoachWorker({ ...settings, registry, runtime })
    const [finished] = await getDb().select().from(coachTasks)
    expect(finished?.state).toBe("succeeded")
    expect(await getDb().select().from(toolIntents)).toEqual([])
    expect(await papersOf(ownerId)).toEqual([])
  }))
