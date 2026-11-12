import { serve } from "@hono/node-server"
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client"
import { z } from "zod"
import { createApp } from "../app.js"
import {
  bindIssuedToken,
  hashAgentToken,
  registeredAgentScopes,
} from "../connections/oauth.js"
import { testSessionSecret, testWebOrigin } from "../test/harness.js"
import { randomUUID } from "node:crypto"

import { delegateActorSchema, paperPackageReadSchema } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterEach, expect, it, vi } from "vitest"

import { withDatabase } from "../db/context.js"
import {
  agentConnections,
  oauthClient,
  oauthAccessToken,
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

const replySchema = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
})

function payload(value: unknown) {
  const reply = replySchema.parse(value)
  const first = reply.content[0]
  if (!first) throw new Error("Missing tool response")
  return z.record(z.string(), z.unknown()).parse(JSON.parse(first.text))
}

it("serves declaration-issued Paper grants over MCP with complete reads and person-approved Word batches", async () => {
  vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
  const database = await createMigratedTestDb()
  const owner = randomUUID()
  const registry = installRegistry()
  let app: ReturnType<typeof createApp>
  const server = serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) => app.fetch(request),
  })
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const address = server.address()
  if (!address || typeof address === "string")
    throw new Error("Missing server port")
  const origin = `http://127.0.0.1:${address.port}`
  const audience = `${origin}/mcp`
  app = createApp({
    db: database.db,
    authUrl: origin,
    sessionSecret: testSessionSecret,
    webOrigins: [testWebOrigin],
    rateLimitEnabled: false,
    sendCodeLimitEnabled: false,
  })
  const clients: Client[] = []
  const run = <T>(fn: () => Promise<T>) => withDatabase(database.db, fn)
  try {
    await database.db
      .insert(user)
      .values({ id: owner, name: "Ada", email: `${owner}@test.invalid` })
    await database.db.insert(oauthClient).values({
      id: "paper-http",
      clientId: "paper-http",
      redirectUris: [`${origin}/callback`],
    })
    async function connect(scopes: string[]) {
      const token = randomUUID()
      await database.db.insert(oauthAccessToken).values({
        id: randomUUID(),
        token: hashAgentToken(token),
        clientId: "paper-http",
        userId: owner,
        authorizationCodeId: randomUUID(),
        resources: [audience],
        scopes,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600_000),
      })
      await run(() => bindIssuedToken({ access_token: token }, audience))
      const client = new Client({
        name: "Paper local MCP client",
        version: "1.0.0",
      })
      clients.push(client)
      await client.connect(
        new StreamableHTTPClientTransport(new URL(audience), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        })
      )
      return client
    }
    const client = await connect(registeredAgentScopes)
    const jobs = await connect(["connection.status", "job.read", "job.write"])
    const names = (await client.listTools()).tools.map((tool) => tool.name)
    expect(names.filter((name) => name.startsWith("paper_"))).toEqual([
      "paper_edit",
      "paper_read",
    ])
    expect(
      (await jobs.listTools()).tools
        .map((tool) => tool.name)
        .filter((name) => name.startsWith("paper_"))
    ).toEqual([])
    const grants = await database.db.select().from(agentConnections)
    expect(grants.map((grant) => grant.resources.kind).sort()).toEqual([
      "jobs",
      "jobs-and-paper",
    ])
    const originals = Array.from(
      { length: 35 },
      (_, index) => `Original paragraph ${index + 1}`
    )
    const doc = await run(async () => {
      const staged = await stageWordPackage(
        owner,
        { requestId: randomUUID(), name: "CV.docx", kind: "cv" },
        fixturePackage(originals.map((text) => paragraph(text)).join(""))
      )
      return publishWordPackage(owner, staged.stageId)
    })
    const read = async (cursor?: string) =>
      paperPackageReadSchema.parse(
        payload(
          await client.callTool({
            name: "paper_read",
            arguments: { docId: doc.docId, ...(cursor ? { cursor } : {}) },
          })
        ).data
      )
    const first = await read()
    const regions = [...first.regions]
    let next = first.nextCursor
    expect(next).not.toBeNull()
    const cursors = new Set<string>()
    while (next) {
      expect(cursors.has(next)).toBe(false)
      cursors.add(next)
      const page = await read(next)
      expect(page.revision).toBe(first.revision)
      regions.push(...page.regions)
      next = page.nextCursor
    }
    expect(regions.map((region) => region.text)).toEqual(originals)
    const [one, two, three] = regions
    if (!one?.paragraph || !two?.paragraph || !three?.paragraph)
      throw new Error("Missing Word handles")
    const edits = [
      { op: "setText", handle: one.paragraph, text: "Reviewed exact words" },
      { op: "insert", after: two.paragraph, text: "Reviewed inserted words" },
      { op: "delete", handle: three.paragraph },
    ]
    const propose = async (basedOn: string, operations = edits) =>
      client.callTool({
        name: "paper_edit",
        arguments: { docId: doc.docId, basedOn, edits: operations },
      })
    const pending = payload(await propose(first.revision))
    expect(pending).toMatchObject({ pending: true, status: "pending approval" })
    const proposalId = z.string().parse(pending.pendingActionId)
    expect((await read()).revision).toBe(first.revision)
    const [stored] = await database.db
      .select()
      .from(pendingActions)
      .where(eq(pendingActions.id, proposalId))
    expect(stored?.status).toBe("pending")
    const pendingForPerson = stored?.frozenReview
    expect(JSON.stringify(pendingForPerson)).toContain("Reviewed exact words")
    expect(JSON.stringify(pendingForPerson)).toContain(
      "Reviewed inserted words"
    )
    expect(JSON.stringify(pendingForPerson)).toContain(originals[2])
    for (const name of [
      "actions_approve",
      "actions_deny",
      "activity_undo",
      "paper_canvas",
      "paper_restore",
      "paper_sync",
      "paper_undoWord",
    ]) {
      expect(names).not.toContain(name)
      await expect(client.callTool({ name, arguments: {} })).rejects.toThrow()
    }
    const receipt = await run(() => registry.approve(owner, proposalId))
    expect(receipt).toBeTruthy()
    expect(
      (await read()).regions.slice(0, 4).map((region) => region.text)
    ).toEqual([
      "Reviewed exact words",
      originals[1],
      "Reviewed inserted words",
      originals[3],
    ])
    expect(replySchema.parse(await propose(first.revision)).isError).toBe(true)
    const committed = await read()
    const denied = payload(
      await propose(committed.revision, [
        { op: "setText", handle: one.paragraph, text: "Denied words" },
      ])
    )
    await run(() =>
      registry.deny(owner, z.string().parse(denied.pendingActionId))
    )
    expect((await read()).revision).toBe(committed.revision)
    if (!receipt) throw new Error("Missing approval receipt")
    await run(() => registry.undo(owner, receipt.id))
    expect((await read()).revision).toBe(first.revision)
    expect((await read()).regions.map((region) => region.text)).toEqual(
      originals.slice(0, first.regions.length)
    )
  } finally {
    for (const client of clients) await client.close()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
    await database.client.close()
    vi.unstubAllEnvs()
  }
}, 30000)
