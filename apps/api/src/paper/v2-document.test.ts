import {
  blocksToPreviewModel,
  emptyCvDocument,
  mergeCodecIntoBlocks,
  previewToCvDocument,
  type CvBlockDocument,
} from "@workspace/domain"
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

  it("stores a merged version 2 document and rejects a body that is neither", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-470-merge@example.com",
    })
    const headers = authHeaders(cookie)
    const createdRes = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { kind: "cv", name: "Ada CV" } }),
    })
    const created = await jsonOf(createdRes)
    const docId = String(created.data?.id)
    const stored: CvBlockDocument = {
      version: 2,
      header: {
        name: "Ada Verify",
        email: "",
        phone: "",
        city: "",
        linkedin: "",
      },
      sections: [
        {
          id: "sec-summary",
          kind: "summary",
          blocks: [
            { id: "sum-1", type: "text", text: "Ships interview notes." },
          ],
        },
        {
          id: "sec-act",
          kind: "activities",
          blocks: [{ id: "act-1", type: "text", text: "Debate club" }],
        },
        {
          id: "sec-aw",
          kind: "awards",
          blocks: [{ id: "aw-1", type: "text", text: "Dean list" }],
        },
      ],
    }
    const edited = previewToCvDocument(
      blocksToPreviewModel(stored, "internship")
    )
    edited.summary = "Ships interview notes.X"
    const output = mergeCodecIntoBlocks(stored, edited)
    const replaceRes = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: created.data?.contentVersion,
          document: output,
        },
      }),
    })
    expect(replaceRes.status).toBe(200)
    const readRes = await app.request(`/api/paper/${docId}`, { headers })
    const read = (await readRes.json()) as {
      data?: {
        document?: {
          version?: number
          sections?: { id: string; blocks: { text?: string }[] }[]
        }
      }
    }
    expect(read.data?.document?.version).toBe(2)
    expect(JSON.stringify(read.data?.document)).toContain(
      "Ships interview notes.X"
    )
    expect(
      read.data?.document?.sections?.find((section) => section.id === "sec-act")
        ?.blocks[0]?.text
    ).toBe("Debate club")
    expect(
      read.data?.document?.sections?.find((section) => section.id === "sec-aw")
        ?.blocks[0]?.text
    ).toBe("Dean list")

    const rejected = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: (created.data?.contentVersion ?? 1) + 1,
          document: { version: 3 },
        },
      }),
    })
    expect(rejected.status).toBe(400)
    const rejectedBody = (await rejected.json()) as {
      error?: { code?: string; message?: string }
    }
    expect(rejectedBody.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid content",
    })
    const header = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: (created.data?.contentVersion ?? 1) + 1,
          document: { version: 2, header: {} },
        },
      }),
    })
    expect(header.status).toBe(400)
    await expect(header.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "Invalid content" },
    })
    await client.close()
  })
})
