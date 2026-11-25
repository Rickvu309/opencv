import { describe, expect, it } from "vitest"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

async function jsonOf(res: Response) {
  return (await res.json()) as {
    ok: boolean
    data?: Record<string, unknown> & {
      jobs?: { title: string; company: string; stage: string }[]
      id?: string
      topic?: string
    }
    error?: { message: string }
  }
}

describe("notify.request and workspace search", () => {
  it("stores pitch once and keeps jobs and proof", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-381-notify@example.com",
    })
    const headers = authHeaders(cookie)

    async function notify(topic: string) {
      const res = await app.request("/api/commands/notify.request", {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: { topic },
          idempotencyKey: `381-${topic}-${crypto.randomUUID()}`,
        }),
      })
      expect(res.status).toBe(200)
      return jsonOf(res)
    }

    const jobs = await notify("jobs")
    const proof = await notify("proof")
    const first = await notify("pitch")
    const second = await notify("pitch")

    expect(jobs.data?.topic).toBe("jobs")
    expect(proof.data?.topic).toBe("proof")
    expect(first.data?.topic).toBe("pitch")
    expect(second.data?.id).toBe(first.data?.id)
    expect(second.data?.topic).toBe("pitch")
    await client.close()
  })

  it("returns the stage word source on each job hit", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-381-search@example.com",
    })
    const headers = authHeaders(cookie)

    const created = await app.request("/api/commands/job.create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          title: "Marketing Executive",
          company: "Lumière Cosmetics",
          stage: "interview",
        },
        idempotencyKey: "381-job",
      }),
    })
    expect(created.status).toBe(200)

    const res = await app.request("/api/reads/workspace.search", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Marketing" }),
    })
    expect(res.status).toBe(200)
    const body = await jsonOf(res)
    expect(body.data?.jobs?.[0]).toMatchObject({
      title: "Marketing Executive",
      company: "Lumière Cosmetics",
      stage: "interview",
    })
    await client.close()
  })
})
