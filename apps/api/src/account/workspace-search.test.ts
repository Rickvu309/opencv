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
    }
    error?: { message: string }
  }
}

describe("workspace search", () => {
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

    const res = await app.request("/api/search?q=Marketing", { headers })
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
