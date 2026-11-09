import { randomUUID } from "node:crypto"

import { delegateActorSchema, paperPackageReadSchema } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterEach, expect, it, vi } from "vitest"

import { registeredAgentScopes } from "../connections/index.js"
import { withDatabase } from "../db/context.js"
import {
  agentConnections,
  oauthClient,
  pendingActions,
  user,
} from "../db/schema.js"
import { fixturePackage, paragraph } from "../paper/package-fixtures.js"
import { publishWordPackage, stageWordPackage } from "../paper/package-store.js"
import { createMigratedTestDb } from "../test/harness.js"
import { CommandError } from "./errors.js"
import { installRegistry } from "./install.js"
import {
  paperAgentError,
  paperAgentRefusal,
  paperEditBasisMessage,
  paperToolAnnotations,
  paperToolDescription,
  publicPaperProposal,
} from "./paper-agent.js"
import { delegateAllowed } from "./delegate-policy.js"

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

it("keeps document tools off and leaves job access unchanged", () => {
  const paper = agent(paperScopes, "none")
  const jobs = agent(["job.read", "job.write"], "jobs")
  expect(registeredAgentScopes).toEqual([
    "connection.status",
    "job.read",
    "job.write",
    "offline_access",
  ])
  expect(paperAgentRefusal("paper.read")).toMatch(/not available to agents/)
  expect(paperAgentRefusal("job.get")).toBeNull()
  expect(delegateAllowed({ name: "paper.read", coach: "never" }, paper)).toBe(
    false
  )
  expect(delegateAllowed({ name: "paper.edit", coach: "confirm" }, paper)).toBe(
    false
  )
  expect(
    delegateAllowed(
      { name: "job.get", coach: "auto", delegate: "jobRead" },
      jobs
    )
  ).toBe(true)
  expect(delegateAllowed({ name: "activity.undo", coach: "never" }, jobs)).toBe(
    false
  )
  expect(paperToolDescription("paper.read")).toMatch(/nextCursor/)
  expect(paperToolDescription("paper.edit")).toMatch(
    /Never report Applied or Saved/
  )
  expect(paperToolAnnotations("paper.read")).toEqual({ idempotentHint: true })
  expect(paperToolAnnotations("paper.edit")).toEqual({})
  expect(paperToolDescription("job.get")).toBeNull()
})

it("opens only the two document tools when the switch and scopes agree", () => {
  vi.stubEnv("PAPER_AGENT_TOOLS", "true")
  const jobs = agent(["job.read", "job.write"], "jobs")
  const readOnly = agent(["paper.read"], "none")
  const paper = agent(paperScopes, "none")
  expect(delegateAllowed({ name: "paper.read", coach: "never" }, jobs)).toBe(
    false
  )
  expect(delegateAllowed({ name: "paper.edit", coach: "confirm" }, jobs)).toBe(
    false
  )
  expect(
    delegateAllowed({ name: "paper.read", coach: "never" }, readOnly)
  ).toBe(true)
  expect(
    delegateAllowed({ name: "paper.edit", coach: "confirm" }, readOnly)
  ).toBe(false)
  expect(delegateAllowed({ name: "paper.read", coach: "never" }, paper)).toBe(
    true
  )
  expect(delegateAllowed({ name: "paper.edit", coach: "confirm" }, paper)).toBe(
    true
  )
  expect(delegateAllowed({ name: "paper.sync", coach: "never" }, paper)).toBe(
    false
  )
  expect(
    delegateAllowed({ name: "activity.undo", coach: "never" }, paper)
  ).toBe(false)
  expect(
    delegateAllowed(
      { name: "job.get", coach: "auto", delegate: "jobRead" },
      paper
    )
  ).toBe(false)
})

it("turns known failures into a next step without private text", () => {
  const leaked = new Error("secret cursor value and /tmp/private")
  leaked.name = "ZodError"
  const read = paperAgentError(leaked, "paper.read")
  expect(read.code).toBe("unsupported")
  expect(read.error).not.toMatch(/secret|\/tmp/)
  expect(read.next).toMatch(/Read the document again/)
  const validation = paperAgentError(
    new CommandError("VALIDATION_ERROR", "before is empty: secret"),
    "paper.edit"
  )
  expect(validation.code).toBe("unsupported")
  expect(validation.error).not.toMatch(/secret/)
  expect(paperAgentError(new Error(paperEditBasisMessage)).code).toBe("reread")
  expect(
    paperAgentError(
      new Error("This text is larger than the supported Word region.")
    ).code
  ).toBe("too_large")
  expect(
    paperAgentError(new Error("Saved Word documents are unavailable.")).next
  ).toMatch(/OpenCV/)
  const proposal = publicPaperProposal(
    {
      pending: true,
      pendingActionId: "proposal-1",
      command: "paper.edit",
      review: { restore: { id: "private" } },
      summary: "Applied Saved",
    },
    "https://opencv.example/coach?chat=1"
  )
  expect(proposal).toEqual({
    pending: true,
    proposalId: "proposal-1",
    status: "pending approval",
    url: "https://opencv.example/coach?chat=1",
  })
  expect(JSON.stringify(proposal)).not.toMatch(/Applied|Saved|restore|private/)
  expect(publicPaperProposal({ pending: true }, undefined)).toBeNull()
})

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
          skipConfirm: true,
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
          skipConfirm: true,
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
          skipConfirm: true,
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
        skipConfirm: true,
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
      await expect(
        registry.approve(userId, proposed.pendingActionId!)
      ).rejects.toThrow(/no longer active/)
      await expect(
        registry.execute({
          name: "activity.undo",
          input: {},
          actor: paper,
          skipConfirm: true,
        })
      ).rejects.toThrow(/connection cannot/)
      const kept = paperPackageReadSchema.parse(
        await registry.read("paper.read", { docId: head.docId }, paper)
      )
      expect(
        kept.regions.find((item) => item.kind === "editable")
      ).toMatchObject({ text: "Original words" })
    })
  } finally {
    await client.close()
  }
})
