import { randomUUID } from "node:crypto"

import { delegateActorSchema, paperPackageReadSchema } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"

import { registeredAgentScopes } from "../connections/oauth.js"
import { createProposalClient } from "../connections/test/proposal-client.js"
import { withDatabase } from "../db/context.js"
import {
  agentConnections,
  oauthClient,
  pendingActions,
  user,
} from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { paperEditBasisMessage } from "../registry/paper-agent.js"
import { createMigratedTestDb } from "../test/harness.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import { publishWordPackage, stageWordPackage } from "./package-store.js"

afterEach(() => {
  vi.unstubAllEnvs()
})

const jobNames = [
  "job.calendar",
  "job.get",
  "job.list",
  "job.move",
  "job.priorityCounts",
  "job.setPriority",
  "job.update",
]

const hidden = [
  "actions.approve",
  "actions.deny",
  "activity.undo",
  "paper.restore",
  "paper.restoreWord",
  "paper.revertEdit",
  "paper.sync",
]

function agent(scopes: string[], resources: "none" | "jobs" | "paper") {
  return delegateActorSchema.parse({
    type: "delegate",
    userId: "user-paper-agent",
    connectionId: "11111111-1111-4111-8111-111111111111",
    name: "Paper agent",
    scopes,
    resources,
    reads: "allow",
    writes: "approval",
  })
}

const paperScopes = ["paper.read", "paper.write"]

it("reads one page and keeps an edit as a proposal", async () => {
  const { db, client } = await createMigratedTestDb()
  const registry = installRegistry()
  const userId = "user-paper-agent"
  const paperId = "11111111-1111-4111-8111-111111111111"
  const jobId = "22222222-2222-4222-8222-222222222222"
  try {
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "paper-agent@example.com",
    })
    await db.insert(oauthClient).values({
      id: "paper-agent-client",
      clientId: "paper-agent-client",
      redirectUris: ["http://localhost/callback"],
    })
    await db.insert(agentConnections).values([
      {
        id: paperId,
        userId,
        clientId: "paper-agent-client",
        authorizationCodeId: "paper-agent-code",
        name: "Paper agent",
        audience: "http://localhost/mcp",
        scopes: paperScopes,
        resources: { kind: "paper" },
        policy: { reads: "allow", writes: "approval" },
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        id: jobId,
        userId,
        clientId: "paper-agent-client",
        authorizationCodeId: "job-agent-code",
        name: "Job agent",
        audience: "http://localhost/mcp",
        scopes: ["job.read", "job.write"],
        resources: { kind: "jobs" },
        policy: { reads: "allow", writes: "approval" },
        expiresAt: new Date(Date.now() + 60_000),
      },
    ])
    const paper = agent(paperScopes, "paper")
    const jobs = delegateActorSchema.parse({
      ...agent(["job.read", "job.write"], "jobs"),
      connectionId: jobId,
    })
    await withDatabase(db, async () => {
      expect((await registry.tools(paper)).map((tool) => tool.name)).toEqual([
        "paper.edit",
        "paper.read",
      ])
      for (const name of hidden)
        expect(
          (await registry.tools(paper)).map((tool) => tool.name)
        ).not.toContain(name)
      expect(
        (await registry.tools(jobs)).map((tool) => tool.name).sort()
      ).toEqual([...jobNames].sort())
      await expect(
        registry.read("paper.read", { docId: randomUUID() }, paper)
      ).rejects.toThrow(/Saved Word documents are unavailable/)
      await expect(
        registry.execute({
          name: "paper.edit",
          input: {
            docId: randomUUID(),
            basedOn: randomUUID(),
            edits: [
              {
                op: "replaceText",
                targetId: `t_${"ab".repeat(32)}`,
                before: "Hello",
                after: "Hi",
              },
            ],
          },
          actor: paper,
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow(/Saved Word documents are unavailable/)
      await expect(
        registry.execute({
          name: "paper.edit",
          input: {
            docId: randomUUID(),
            basedOn: 1,
            edits: [{ op: "setText", blockId: "letter-1", text: "Hello" }],
          },
          actor: paper,
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow(paperEditBasisMessage)
      expect(
        await db
          .select()
          .from(pendingActions)
          .where(eq(pendingActions.userId, userId))
      ).toEqual([])

      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      const bytes = fixturePackage(paragraph("Original words"))
      const staged = await stageWordPackage(
        userId,
        {
          requestId: randomUUID(),
          name: "Letter.docx",
          kind: "letter",
        },
        bytes
      )
      const head = await publishWordPackage(userId, staged.stageId)
      const page = paperPackageReadSchema.parse(
        await registry.read("paper.read", { docId: head.docId }, paper)
      )
      expect(page.docId).toBe(head.docId)
      expect(page.revision).toBe(head.revision)
      expect(page.nextCursor).toBeNull()
      const region = page.regions.find((item) => item.kind === "editable")
      if (!region || region.kind !== "editable")
        throw new Error("missing editable region")
      expect(region.text).toBe("Original words")
      await expect(
        registry.read(
          "paper.read",
          { docId: head.docId, cursor: "x".repeat(2049) },
          paper
        )
      ).rejects.toThrow()
      const proposed = await registry.execute({
        name: "paper.edit",
        input: {
          docId: page.docId,
          basedOn: page.revision,
          edits: [
            {
              op: "replaceText",
              targetId: region.targetId,
              before: region.text,
              after: "Trusted words",
            },
          ],
        },
        actor: paper,
        idempotencyKey: randomUUID(),
      })
      expect(proposed.pending).toBe(true)
      expect(proposed.activityId).toBeNull()
      const again = paperPackageReadSchema.parse(
        await registry.read(
          "paper.read",
          { docId: head.docId, at: head.revision },
          paper
        )
      )
      expect(again.revision).toBe(page.revision)
      expect(
        again.regions.find((item) => item.kind === "editable")
      ).toMatchObject({ text: "Original words" })
      const approved = await registry.approve(userId, proposed.pendingActionId!)
      expect(approved).toBeTruthy()
      const committed = paperPackageReadSchema.parse(
        await registry.read("paper.read", { docId: head.docId }, paper)
      )
      expect(
        committed.regions.find((item) => item.kind === "editable")
      ).toMatchObject({ text: "Trusted words" })
      await expect(
        registry.execute({
          name: "activity.undo",
          input: {},
          actor: paper,
        })
      ).rejects.toThrow(/connection cannot/)
    })
  } finally {
    await client.close()
  }
})

const replySchema = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
})

function reply(value: unknown) {
  const parsed = replySchema.parse(value)
  const first = parsed.content[0]
  if (!first) throw new Error("Missing tool response")
  return {
    isError: parsed.isError === true,
    body: z.record(z.string(), z.unknown()).parse(JSON.parse(first.text)),
  }
}

const doorScope = registeredAgentScopes.join(" ")

it("opens Paper to a consented agent over MCP and writes only what the person approves", async () => {
  vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
  const door = await createProposalClient(doorScope)
  const jobsOnly = await createProposalClient()
  try {
    const owner = door.owner.user.id
    const names = (await door.sdk.listTools()).tools.map((tool) => tool.name)
    expect(names.filter((name) => name.startsWith("paper_"))).toEqual([
      "paper_edit",
      "paper_read",
    ])
    const tools = (await door.sdk.listTools()).tools
    const readTool = tools.find((tool) => tool.name === "paper_read")
    const editTool = tools.find((tool) => tool.name === "paper_edit")
    expect(readTool?.description).toMatch(/nextCursor/)
    expect(readTool?.annotations).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
    })
    expect(editTool?.description).toMatch(/setText/)
    expect(editTool?.description).toMatch(/approves/)
    expect(editTool?.description).toMatch(
      /do not invent the person's experience or qualifications/
    )
    expect(
      (await jobsOnly.sdk.listTools()).tools
        .map((tool) => tool.name)
        .filter((name) => name.startsWith("paper_"))
    ).toEqual([])
    const [grant] = await door.db
      .select()
      .from(agentConnections)
      .where(eq(agentConnections.userId, owner))
    expect(grant?.resources).toEqual({ kind: "jobs-and-paper" })
    const [jobGrant] = await jobsOnly.db
      .select()
      .from(agentConnections)
      .where(eq(agentConnections.userId, jobsOnly.owner.user.id))
    expect(jobGrant?.resources).toEqual({ kind: "jobs" })

    const originals = Array.from(
      { length: 35 },
      (_, index) => `Original paragraph ${index + 1}`
    )
    const doc = await withDatabase(door.db, async () => {
      const staged = await stageWordPackage(
        owner,
        { requestId: randomUUID(), name: "CV.docx", kind: "cv" },
        fixturePackage(originals.map((text) => paragraph(text)).join(""))
      )
      return publishWordPackage(owner, staged.stageId)
    })
    const read = async (cursor?: string) => {
      const result = reply(
        await door.sdk.callTool({
          name: "paper_read",
          arguments: { docId: doc.docId, ...(cursor ? { cursor } : {}) },
        })
      )
      expect(result.isError, JSON.stringify(result.body)).toBe(false)
      return paperPackageReadSchema.parse(result.body.data)
    }
    const first = await read()
    expect(first.nextCursor).not.toBeNull()
    const regions = [...first.regions]
    let next = first.nextCursor
    let pages = 1
    while (next) {
      const page = await read(next)
      expect(page.revision).toBe(first.revision)
      regions.push(...page.regions)
      next = page.nextCursor
      pages += 1
    }
    expect(pages).toBeGreaterThan(1)
    expect(regions.map((region) => region.text)).toEqual(originals)
    const [one, two, three] = regions
    if (!one?.paragraph || !two?.paragraph || !three?.paragraph)
      throw new Error("Missing Word handles")

    const propose = async (basedOn: string, edits: unknown[]) =>
      reply(
        await door.sdk.callTool({
          name: "paper_edit",
          arguments: { docId: doc.docId, basedOn, edits },
        })
      )
    const proposed = await propose(first.revision, [
      { op: "setText", handle: one.paragraph, text: "Reviewed exact words" },
      { op: "insert", after: two.paragraph, text: "Reviewed inserted words" },
      { op: "delete", handle: three.paragraph },
    ])
    expect(proposed.isError, JSON.stringify(proposed.body)).toBe(false)
    expect(proposed.body).toMatchObject({
      pending: true,
      status: "pending approval",
    })
    const proposalId = z.uuid().parse(proposed.body.proposalId)
    expect((await read()).revision).toBe(first.revision)
    const [stored] = await door.db
      .select()
      .from(pendingActions)
      .where(eq(pendingActions.id, proposalId))
    expect(stored).toMatchObject({ status: "pending", command: "paper.edit" })
    const frozen = JSON.stringify(stored?.frozenReview)
    for (const words of [
      "Original paragraph 1",
      "Reviewed exact words",
      "Reviewed inserted words",
      "Original paragraph 3",
    ])
      expect(frozen).toContain(words)

    for (const name of [
      "actions_approve",
      "actions_deny",
      "activity_undo",
      "paper_canvas",
      "paper_restore",
      "paper_restoreWord",
      "paper_sync",
    ]) {
      expect(names).not.toContain(name)
      await expect(door.sdk.callTool({ name, arguments: {} })).rejects.toThrow()
    }

    const approved = await door.command("actions.approve", {
      pendingActionId: proposalId,
    })
    expect(approved.status, await approved.clone().text()).toBe(200)
    const receipt = z
      .object({
        data: z.object({ id: z.uuid(), actor: z.literal("delegate") }),
      })
      .parse(await approved.json())
    const committed = await read()
    expect(committed.revision).not.toBe(first.revision)
    expect(committed.regions.slice(0, 4).map((region) => region.text)).toEqual([
      "Reviewed exact words",
      "Original paragraph 2",
      "Reviewed inserted words",
      "Original paragraph 4",
    ])

    const stale = await propose(first.revision, [
      { op: "setText", handle: one.paragraph, text: "Stale words" },
    ])
    expect(stale.isError).toBe(true)
    expect(JSON.stringify(stale.body)).toMatch(
      /Read it again|read it again|Read the document again/
    )

    const denied = await propose(committed.revision, [
      { op: "setText", handle: one.paragraph, text: "Denied words" },
    ])
    expect(denied.isError, JSON.stringify(denied.body)).toBe(false)
    const deniedResponse = await door.command("actions.deny", {
      pendingActionId: z.uuid().parse(denied.body.proposalId),
    })
    expect(deniedResponse.status, await deniedResponse.text()).toBe(200)
    const afterDeny = await read()
    expect(afterDeny.revision).toBe(committed.revision)
    expect(afterDeny.regions[0]?.text).toBe("Reviewed exact words")

    const undone = await door.command("activity.undo", {
      activityId: receipt.data.id,
    })
    expect(undone.status, await undone.text()).toBe(200)
    const restored = await read()
    expect(restored.regions.map((region) => region.text)).toEqual(
      originals.slice(0, restored.regions.length)
    )
  } finally {
    await door.close()
    await jobsOnly.close()
  }
}, 60000)
