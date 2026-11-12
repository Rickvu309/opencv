import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, expect, it } from "vitest"
import { z } from "zod"
import {
  activity,
  agentConnections,
  jobs,
  pendingActions,
} from "../db/schema.js"
import { createProposalClient } from "../test/proposal-client.js"

let fixture: Awaited<ReturnType<typeof createProposalClient>>
beforeAll(async () => {
  fixture = await createProposalClient()
}, 30000)
afterAll(async () => {
  await fixture?.close()
})

const textResult = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
})
const proposalSchema = z.object({
  proposalId: z.uuid(),
  pendingActionId: z.uuid(),
  pending: z.literal(true),
  status: z.literal("pending approval"),
  url: z.url(),
  chatId: z.uuid(),
  trust: z.literal("untrusted"),
  untrustedData: z.string().startsWith("Untrusted data:"),
})
const receipt = z.object({
  data: z.object({ id: z.uuid(), actor: z.literal("delegate") }),
})
const decode = (value: unknown) =>
  JSON.parse(z.string().parse(textResult.parse(value).content[0]?.text))
const priority = async (jobId: string) =>
  (await fixture.db.select().from(jobs).where(eq(jobs.id, jobId)))[0]?.priority
const receipts = (jobId: string) =>
  fixture.db
    .select()
    .from(activity)
    .where(
      and(
        eq(activity.subjectId, jobId),
        eq(activity.command, "job.setPriority"),
        eq(activity.actor, "delegate")
      )
    )
async function createJob() {
  const response = await fixture.command("job.create", {
    title: "M5 fixture",
    company: "Local only",
  })
  expect(response.status).toBe(200)
  return z
    .object({ data: z.object({ id: z.uuid() }) })
    .parse(await response.json()).data.id
}
async function propose(jobId: string) {
  const result = await fixture.sdk.callTool({
    name: "job_setPriority",
    arguments: { jobId, priority: "high" },
  })
  expect(result.isError).not.toBe(true)
  const proposal = proposalSchema.parse(decode(result))
  expect(proposal.proposalId).toBe(proposal.pendingActionId)
  expect(proposal.url).toBe(`https://opencv.me/coach?chat=${proposal.chatId}`)
  expect(JSON.stringify(result)).not.toContain("previousPriority")
  return proposal
}

it("keeps official-client proposals pending, survives a lost approval response and keyed retries, and gives Undo only to a separate person session", async () => {
  expect(fixture.owner.user.id).toBe(fixture.consentSession.user.id)
  expect(fixture.owner.session.id).not.toBe(fixture.consentSession.session.id)
  const names = (await fixture.sdk.listTools()).tools
    .map((tool) => tool.name)
    .sort()
  expect(names).toEqual([
    "job_calendar",
    "job_get",
    "job_list",
    "job_move",
    "job_priorityCounts",
    "job_setPriority",
    "job_update",
  ])
  for (const name of ["activity_undo", "inbox_send", "account_delete"]) {
    expect(names).not.toContain(name)
    await expect(fixture.sdk.callTool({ name, arguments: {} })).rejects.toThrow(
      "not found"
    )
  }
  const jobId = await createJob()
  const proposal = await propose(jobId)
  expect(await priority(jobId)).toBe("normal")
  expect(await receipts(jobId)).toHaveLength(0)
  const [stored] = await fixture.db
    .select()
    .from(pendingActions)
    .where(eq(pendingActions.id, proposal.proposalId))
  expect(stored).toMatchObject({
    status: "pending",
    userId: fixture.owner.user.id,
    command: "job.setPriority",
  })
  const key = randomUUID()
  fixture.loseNextApprovalResponse()
  await expect(
    (async () => {
      const response = await fixture.command(
        "actions.approve",
        { pendingActionId: proposal.proposalId },
        key
      )
      await response.json()
    })()
  ).rejects.toThrow()
  expect(await priority(jobId)).toBe("high")
  const committed = await receipts(jobId)
  expect(committed).toHaveLength(1)
  for (const retryKey of [key, key, randomUUID()]) {
    const response = await fixture.command(
      "actions.approve",
      { pendingActionId: proposal.proposalId },
      retryKey
    )
    expect(response.status).toBe(200)
    expect(receipt.parse(await response.json()).data.id).toBe(committed[0]?.id)
  }
  expect(await receipts(jobId)).toHaveLength(1)
  const undone = await fixture.command("activity.undo", {
    activityId: committed[0]?.id,
  })
  expect(undone.status, await undone.text()).toBe(200)
  expect(await priority(jobId)).toBe("normal")
  const read = await fixture.sdk.callTool({
    name: "job_get",
    arguments: { jobId },
  })
  expect(decode(read)).toMatchObject({
    trust: "untrusted",
    data: { priority: "normal" },
  })
  console.info(
    JSON.stringify({
      backend: fixture.backend,
      client: "@modelcontextprotocol/client 2.4.0",
      transport: "real loopback HTTP",
      tools: names,
      approvalLink: proposal.url,
      proposalId: proposal.proposalId,
      receiptId: committed[0]?.id,
      distinctPersonSession: true,
      lostResponse: "post-commit response stream failure",
      retainedReceipts: 1,
      personUndo: "normal",
    })
  )
}, 30000)

it("rejects approval on a changed Job head and after connection revocation without a delegate write", async () => {
  const staleJob = await createJob()
  const stale = await propose(staleJob)
  expect(
    (
      await fixture.command("job.setPriority", {
        jobId: staleJob,
        priority: "low",
      })
    ).status
  ).toBe(200)
  const conflicted = await fixture.command("actions.approve", {
    pendingActionId: stale.proposalId,
  })
  expect(conflicted.status).toBe(409)
  expect(await priority(staleJob)).toBe("low")
  expect(await receipts(staleJob)).toHaveLength(0)
  const jobId = await createJob()
  const pending = await propose(jobId)
  const [grant] = await fixture.db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.userId, fixture.owner.user.id))
  if (!grant) throw new Error("Missing connection")
  expect(
    (await fixture.command("connections.revoke", { connectionId: grant.id }))
      .status
  ).toBe(200)
  const refused = await fixture.command("actions.approve", {
    pendingActionId: pending.proposalId,
  })
  expect(refused.status).toBe(403)
  expect(await priority(jobId)).toBe("normal")
  expect(await receipts(jobId)).toHaveLength(0)
  await expect(fixture.sdk.listTools()).rejects.toThrow()
}, 30000)
