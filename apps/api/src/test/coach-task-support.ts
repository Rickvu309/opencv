import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { getDb } from "../db/context.js"
import { chats, coachTasks, coachUsage, user } from "../db/schema.js"
export async function seedTask(inputHash: (input: unknown) => string) {
  const ownerId = randomUUID(),
    chatId = randomUUID(),
    taskId = randomUUID()
  await getDb()
    .insert(user)
    .values({ id: ownerId, name: "Ada", email: `${ownerId}@test.local` })
  await getDb()
    .insert(chats)
    .values({ id: chatId, userId: ownerId, title: "Task" })
  await getDb()
    .insert(coachTasks)
    .values({
      id: taskId,
      ownerId,
      chatId,
      startKey: taskId,
      startInputHash: inputHash({}),
      catalogDigest: "test",
      runtimeVersion: 1,
      modelId: "fake",
      mode: "free",
      planAtStart: "free",
      toolsAllowed: true,
      contextSnapshot: {},
      maxSteps: 10,
      maxTokens: 1000,
      deadlineAt: sql`clock_timestamp() + interval '1 hour'`,
    })
  await getDb().insert(coachUsage).values({
    id: randomUUID(),
    userId: ownerId,
    chatId,
    coachTaskId: taskId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
  const input = { title: "Durable role", company: "Acme" }
  const intent = {
    step: 0,
    slot: 0,
    intentKey: `coach:${taskId}:0:0`,
    providerToolUseId: "tool-0",
    operation: "job.create",
    operationVersion: 1,
    input,
    inputHash: inputHash(input),
    observedRevisions: [],
    kind: "command" as const,
  }
  return { ownerId, taskId, intent }
}
