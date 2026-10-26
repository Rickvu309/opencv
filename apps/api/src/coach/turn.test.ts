import { THREAD_COMMANDS, titleFrom } from "@workspace/domain"
import { afterAll, describe, expect, it } from "vitest"

import { createDemoCoachRuntime } from "./fake.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

const prompt = "Help me prepare for a product intern interview"

describe("coach turn title", () => {
  let close: (() => Promise<void>) | undefined

  afterAll(async () => {
    await close?.()
  })

  it("replaces the first-line title after the scripted turn", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const { cookie } = await signUp(app, {
      name: "Ada Verify",
      email: "ada-title@verify.local",
      password: "Verify-pass-123",
    })
    const headers = authHeaders(cookie)

    const created = await app.request(`/api/commands/${THREAD_COMMANDS.create}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: titleFrom(prompt) }),
    })
    expect(created.status).toBe(200)
    const createdBody = (await created.json()) as {
      data: { id: string; title: string }
    }
    expect(createdBody.data.title).toBe(titleFrom(prompt))

    const turn = await app.request(`/api/threads/${createdBody.data.id}/coach`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: prompt }),
    })
    expect(turn.status).toBe(200)
    const sse = await turn.text()
    expect(sse).toContain("Prep the starred one next.")

    const list = await app.request("/api/threads", { headers })
    expect(list.status).toBe(200)
    const threads = (await list.json()) as {
      data: { id: string; title: string }[]
    }
    expect(threads.data.find((thread) => thread.id === createdBody.data.id)?.title).toBe(
      "Prepare for a product intern interview"
    )
  })
})
