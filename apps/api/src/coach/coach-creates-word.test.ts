import {
  coachActor,
  parseChatId,
  parseUserId,
  personActor,
} from "@workspace/domain"
import { asc, eq } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"

import { getChat } from "../chat/index.js"
import { getDb } from "../db/context.js"
import { coachTasks, coachUsage, toolIntents } from "../db/schema.js"
import type { Registry } from "../registry/registry.js"
import { createTaskRuntime } from "./task-runtime.js"
import { fixture, settings } from "./worker-fixture.js"
import { runCoachWorker } from "./worker.js"

const startedSchema = z.object({
  output: z.object({
    generation: z.literal("package"),
    docId: z.string(),
    name: z.string(),
    kind: z.enum(["cv", "letter"]),
    revision: z.string(),
  }),
})

async function outlineOf(registry: Registry, ownerId: string, docId: string) {
  return z
    .object({ outline: z.string(), revision: z.string() })
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
  expect(before.revision).toBe(started.revision)
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
  const download = z
    .object({ downloadPath: z.string(), name: z.string() })
    .parse(
      await registry.read(
        "paper.export",
        { docId: started.docId, at: undone.revision },
        personActor(ownerId)
      )
    )
  expect(download.downloadPath).toMatch(/^\/api\/paper\/packages\//)
  expect(download.name).toBe(started.name)
  return { started, before }
}

it("a CV the Coach starts is a Word page it reads, edits with approval and Undo", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    const { started, before } = await createTurn(registry, ownerId, taskId, {
      messages: [{ role: "user", content: "Make me a CV" }],
    })
    expect(started).toMatchObject({ kind: "cv", name: "Simple CV.docx" })
    expect(before.outline).toContain("[Your name]")
    expect(before.outline).toContain("[Role, company] | [Dates]")
    const papers = z
      .array(z.object({ id: z.string() }).passthrough())
      .parse(await registry.read("paper.list", {}, personActor(ownerId)))
    expect(papers.map((paper) => paper.id)).toEqual([started.docId])
  }))

it("a Letter the Coach starts for a Job is a blank Word page named for the Job", () =>
  fixture(async ({ taskId, ownerId }, registry) => {
    const created = await registry.execute({
      name: "job.create",
      input: { title: "Product designer", company: "Lumiere" },
      actor: personActor(ownerId),
    })
    const jobId = z.object({ id: z.string() }).parse(created.output).id
    const { started, before } = await createTurn(registry, ownerId, taskId, {
      messages: [
        { role: "user", content: "Start a cover letter for this Job" },
      ],
      context: [{ kind: "job", id: jobId }],
    })
    expect(started).toMatchObject({
      kind: "letter",
      name: "Cover letter, Lumiere.docx",
    })
    expect(before.outline).toContain("(empty line)")
    expect(before.outline).not.toContain("[Your name]")
    const [start] = await getDb()
      .select()
      .from(toolIntents)
      .orderBy(asc(toolIntents.step))
    expect(start?.input).toEqual({ kind: "letter", jobId })
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
    expect(names).not.toContain("paper.canvas")
  }))
