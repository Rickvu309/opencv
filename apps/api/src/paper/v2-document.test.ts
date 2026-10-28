import { emptyCvDocument } from "@workspace/domain"
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
    data?: {
      id?: string
      contentVersion?: number
      document?: { version?: number; name?: string; experience?: unknown[] }
    }
  }
}

const v1Fixture = {
  ...emptyCvDocument(),
  name: "Lan Nguyen",
  headline: "Product intern",
  contact: {
    email: "lan@example.com",
    phone: "+84 912 345 678",
    location: "Hanoi",
    linkedin: "linkedin.com/in/lan",
  },
  summary: "Ships small experiments.",
  experience: [
    {
      role: "Discovery lead",
      company: "UIT Product Club",
      period: "2024 – Present",
      bullets: ["Ran interviews"],
    },
  ],
  education: [
    {
      school: "UIT",
      degree: "B.Sc. Information Systems",
      period: "2022 – 2026",
      detail: "HCI",
    },
  ],
  skills: [{ label: "Product", items: ["Interviews", "PRDs"] }],
}

describe("version 2 CV documents", () => {
  it("stores version 2 on create and still accepts a v1 replace", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Lan",
      email: "lan-470@example.com",
    })
    const headers = authHeaders(cookie)

    const createdRes = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { kind: "cv", name: "Lan CV" } }),
    })
    expect(createdRes.status).toBe(200)
    const created = await jsonOf(createdRes)
    const docId = String(created.data?.id)
    expect(created.data?.document?.version).toBe(2)

    const readRes = await app.request(`/api/paper/${docId}`, { headers })
    expect(readRes.status).toBe(200)
    const read = await jsonOf(readRes)
    expect(read.data?.document?.version).toBe(2)
    expect(read.data?.document).toMatchObject({
      header: {
        name: "",
        email: "",
        phone: "",
        city: "",
        linkedin: "",
      },
      sections: [
        { kind: "experience" },
        { kind: "education" },
        { kind: "skills" },
      ],
    })

    const replaceRes = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: created.data?.contentVersion,
          document: v1Fixture,
        },
      }),
    })
    expect(replaceRes.status).toBe(200)
    const replaced = await jsonOf(replaceRes)
    expect(replaced.data?.document?.version).toBeUndefined()
    expect(replaced.data?.document).toMatchObject({
      name: "Lan Nguyen",
      experience: v1Fixture.experience,
    })
    await client.close()
  })
})
