import { delegateActorSchema } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { agentConnections, oauthClient } from "../db/schema.js"
import { createId } from "../id.js"
import {
  dataOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"

type Connection = { id: string; name: string; revokedAt: string | null }

let world: World
let agents = 0

beforeAll(async () => {
  world = await openWorld()
})

afterAll(async () => {
  await world.close()
})

async function connectAgent(person: Person, name: string) {
  agents += 1
  const connectionId = createId()
  const clientId = `scenario-client-${agents}`
  await world.db.insert(oauthClient).values({
    id: clientId,
    clientId,
    redirectUris: ["http://localhost/callback"],
  })
  await world.db.insert(agentConnections).values({
    id: connectionId,
    userId: person.id,
    clientId,
    authorizationCodeId: `scenario-authorization-${agents}`,
    name,
    audience: "http://localhost/mcp",
    scopes: ["connection.status", "job.read", "job.write"],
    resources: { kind: "jobs" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt: new Date(Date.now() + 600_000),
  })
  const delegate = delegateActorSchema.parse({
    type: "delegate",
    userId: person.id,
    connectionId,
    name,
    scopes: ["job.read", "job.write"],
    resources: "jobs",
    reads: "allow",
    writes: "approval",
  })
  return { connectionId, delegate }
}

async function connections(person: Person) {
  return dataOf<Connection[]>(await person.get("/api/agent-connections"))
}

describe("a person's own agents", () => {
  it("are none until one is connected", async () => {
    const ada = await world.person("Ada")
    expect(await connections(ada)).toEqual([])
  })

  it("are listed by name for the person who connected them, and nobody else", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const agent = await connectAgent(ada, "Ada's agent")
    expect(await connections(ada)).toMatchObject([
      { id: agent.connectionId, name: "Ada's agent", revokedAt: null },
    ])
    expect(await connections(grace)).toEqual([])
  })
})

describe("a Delegate with a grant for Jobs", () => {
  it("reads the person's Jobs and is refused their Papers", async () => {
    const ada = await world.person("Ada")
    await ada.run("job.create", { title: "Intern", company: "Northwind" })
    const { delegate } = await connectAgent(ada, "Jobs agent")
    const jobs = await world.inside(() =>
      world.registry.read("job.list", {}, delegate)
    )
    expect(jobs).toMatchObject([{ title: "Intern" }])
    await expect(
      world.inside(() => world.registry.read("paper.list", {}, delegate))
    ).rejects.toThrow()
  })

  it("proposes a change, which waits until the person approves it", async () => {
    const ada = await world.person("Ada")
    const job = dataOf<{ id: string }>(
      await ada.run("job.create", { title: "Intern", company: "Northwind" })
    )
    const { delegate } = await connectAgent(ada, "Jobs agent")
    const proposed = await world.inside(() =>
      world.registry.execute({
        name: "job.setPriority",
        input: { jobId: job.id, priority: "high" },
        actor: delegate,
      })
    )
    expect(proposed.pending).toBe(true)
    expect(
      dataOf<{ priority: string }>(await ada.get(`/api/jobs/${job.id}`))
        .priority
    ).toBe("normal")
    const approved = await ada.run("actions.approve", {
      pendingActionId: proposed.pendingActionId,
    })
    expect(approved.status).toBe(200)
    expect(
      dataOf<{ priority: string }>(await ada.get(`/api/jobs/${job.id}`))
        .priority
    ).toBe("high")
  })

  it("cannot touch another person's Job", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const theirs = dataOf<{ id: string }>(
      await grace.run("job.create", { title: "Theirs", company: "Elsewhere" })
    )
    const { delegate } = await connectAgent(ada, "Jobs agent")
    await expect(
      world.inside(() =>
        world.registry.execute({
          name: "job.setPriority",
          input: { jobId: theirs.id, priority: "high" },
          actor: delegate,
        })
      )
    ).rejects.toThrow()
  })
})

describe("revoking an agent connection", () => {
  it("shows it as revoked and leaves its open proposal unable to run", async () => {
    const ada = await world.person("Ada")
    const job = dataOf<{ id: string }>(
      await ada.run("job.create", { title: "Intern", company: "Northwind" })
    )
    const agent = await connectAgent(ada, "Jobs agent")
    const proposed = await world.inside(() =>
      world.registry.execute({
        name: "job.setPriority",
        input: { jobId: job.id, priority: "high" },
        actor: agent.delegate,
      })
    )
    const revoked = await ada.run("connections.revoke", {
      connectionId: agent.connectionId,
    })
    expect(revoked.status).toBe(200)
    const listed = await connections(ada)
    expect(
      listed.find((connection) => connection.id === agent.connectionId)
        ?.revokedAt ?? null
    ).not.toBeNull()
    const approval = await ada.run("actions.approve", {
      pendingActionId: proposed.pendingActionId,
    })
    expect(approval.ok).toBe(false)
    expect(
      dataOf<{ priority: string }>(await ada.get(`/api/jobs/${job.id}`))
        .priority
    ).toBe("normal")
  })
})
