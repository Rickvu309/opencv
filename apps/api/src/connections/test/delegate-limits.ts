import type { Client } from "@modelcontextprotocol/client"
import { expect } from "vitest"
import type { TestDatabase } from "../../db/context.js"
import { chats, pendingActions } from "../../db/schema.js"

export async function expectDelegateLimits(
  sdk: Client,
  db: TestDatabase,
  jobId: string
) {
  for (let index = 0; index < 19; index += 1) {
    const proposed = await sdk.callTool({
      name: "job_setPriority",
      arguments: { jobId, priority: "high" },
    })
    expect(proposed.isError).not.toBe(true)
  }
  const beforeChats = (await db.select().from(chats)).length
  const capped = await sdk.callTool({
    name: "job_setPriority",
    arguments: { jobId, priority: "high" },
  })
  expect(capped.isError).toBe(true)
  expect(JSON.stringify(capped)).toContain("20 pending proposals")
  expect((await db.select().from(chats)).length).toBe(beforeChats)
  expect(
    (await db.select().from(pendingActions)).filter(
      (proposal) => proposal.status === "pending"
    )
  ).toHaveLength(20)
  const calls = []
  for (let index = 0; index < 65; index += 1) {
    calls.push(await sdk.callTool({ name: "job_get", arguments: { jobId } }))
  }
  expect(
    calls.some(
      (call) => call.isError && JSON.stringify(call).includes("rate limit")
    )
  ).toBe(true)
}
