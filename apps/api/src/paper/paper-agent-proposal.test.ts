import { randomUUID } from "node:crypto"

import { delegateActorSchema, paperWordReadSchema } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterEach, expect, it, vi } from "vitest"

import { withDatabase } from "../db/context.js"
import {
  agentConnections,
  oauthClient,
  pendingActions,
  user,
} from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import {
  paperEditBasisMessage,
  publicPaperProposal,
} from "../registry/paper-agent.js"
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

function agent(scopes: string[], resources: "none" | "jobs") {
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
        resources: { kind: "none" },
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
    const paper = agent(paperScopes, "none")
    const jobs = delegateActorSchema.parse({
      ...agent(["job.read", "job.write"], "jobs"),
      connectionId: jobId,
    })
    await withDatabase(db, async () => {
      expect((await registry.tools(paper)).map((tool) => tool.name)).toEqual([])
      await expect(
        registry.read("paper.read", { docId: randomUUID() }, paper)
      ).rejects.toThrow(/not available to agents yet/)
      await expect(
        registry.execute({
          name: "paper.edit",
          input: {},
          actor: paper,
        })
      ).rejects.toThrow(/not available to agents yet/)
      expect(
        (await registry.tools(jobs)).map((tool) => tool.name).sort()
      ).toEqual([...jobNames].sort())

      vi.stubEnv("PAPER_AGENT_TOOLS", "true")
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
      ).rejects.toThrow(/This Word document or version is not available/)
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
      const page = paperWordReadSchema.parse(
        await registry.read(
          "paper.read",
          { view: "lines", docId: head.docId },
          paper
        )
      )
      expect(page.docId).toBe(head.docId)
      expect(page.revision).toBe(head.revision)
      expect(page.nextCursor).toBeNull()
      const region = page.paragraphs.find((item) => !item.held)
      if (!region || region.held) throw new Error("missing editable region")
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
              op: "setText",
              handle: region.handle,
              text: "Trusted words",
            },
          ],
        },
        actor: paper,
        idempotencyKey: randomUUID(),
      })
      expect(proposed.pending).toBe(true)
      expect(proposed.activityId).toBeNull()
      const shaped = publicPaperProposal(
        proposed,
        "https://opencv.example/coach?chat=1"
      )
      expect(shaped?.proposalId).toBe(proposed.pendingActionId)
      expect(shaped?.status).toBe("pending approval")
      expect(JSON.stringify(shaped)).not.toMatch(/Applied|Saved|restore/)
      const again = paperWordReadSchema.parse(
        await registry.read(
          "paper.read",
          { view: "lines", docId: head.docId, at: head.revision },
          paper
        )
      )
      expect(again.revision).toBe(page.revision)
      expect(again.paragraphs.find((item) => !item.held)).toMatchObject({
        text: "Original words",
      })
      await expect(
        registry.approve(userId, proposed.pendingActionId!)
      ).rejects.toThrow(/no longer active/)
      await expect(
        registry.execute({
          name: "activity.undo",
          input: {},
          actor: paper,
        })
      ).rejects.toThrow(/connection cannot/)
      const kept = paperWordReadSchema.parse(
        await registry.read(
          "paper.read",
          { view: "lines", docId: head.docId },
          paper
        )
      )
      expect(kept.paragraphs.find((item) => !item.held)).toMatchObject({
        text: "Original words",
      })
    })
  } finally {
    await client.close()
  }
})
