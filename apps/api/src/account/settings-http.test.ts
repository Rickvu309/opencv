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
    const res = await app.request("/api/reads/integrations.list", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({}),
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
    const res = await app.request("/api/reads/billing.get", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: true
      data: {
        plan: string
        pro: { benefits: string[] }
        invoices: unknown[]
        payment: null
      }
    }
    expect(body.data.plan).toBe("free")
    expect(body.data.pro.benefits).toEqual([
      "Unlimited Coach chats",
      "Stronger Coach model",
      "Priority support",
      "Early access to Proof",
    ])
    expect(body.data.invoices).toEqual([])
    expect(body.data.payment).toBeNull()
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
