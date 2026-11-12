import { describe, expect, it } from "vitest"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

describe("settings reads", () => {
  it("lists Gmail as disabled in the Enabled group when no connection exists", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-integrations@example.com",
    })
    const res = await app.request("/api/integrations", {
      headers: authHeaders(cookie),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: true
      data: {
        groups: {
          id: string
          label: string
          items: { id: string; name: string; status: string }[]
        }[]
      }
    }
    const enabled = body.data.groups.find((group) => group.id === "enabled")
    expect(enabled?.label).toBe("Enabled")
    expect(enabled?.items.find((item) => item.name === "Gmail")).toMatchObject({
      id: "gmail",
      status: "disabled",
    })
    expect(enabled?.items.find((item) => item.name === "Outlook")?.status).toBe(
      "unavailable"
    )
    await client.close()
  })

  it("returns the four Pro benefits and an empty invoice list", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-billing@example.com",
    })
    const res = await app.request("/api/billing", {
      headers: authHeaders(cookie),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: true
      data: {
        plan: string
        pro: { line: string; benefits: string[] }
      }
    }
    expect(body.data.plan).toBe("free")
    expect(body.data.pro.line).toBe("Not on sale yet.")
    expect(body.data.pro.benefits).toEqual(["Stronger Coach model"])
    expect(Object.keys(body.data).sort()).toEqual(["free", "plan", "pro"])
    await client.close()
  })

  it("returns 404 for profile.setCoachMode and still accepts coachMode on profile.update", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-mode@example.com",
    })
    const removed = await app.request("/api/commands/profile.setCoachMode", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ mode: "light" }),
    })
    expect(removed.status).toBe(404)

    const updated = await app.request("/api/commands/profile.update", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ coachMode: "free" }),
    })
    expect(updated.status).toBe(200)
    const body = (await updated.json()) as {
      ok: true
      data: { coachMode: string }
    }
    expect(body.data.coachMode).toBe("free")
    await client.close()
  })
})
