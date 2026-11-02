import { eq } from "drizzle-orm"
import {
  blankBlockDocument,
  emptyCvDocument,
  type CvBlockDocument,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { paperDocs } from "../db/schema.js"
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

const v2Fixture: CvBlockDocument = {
  version: 2,
  header: {
    name: "Lan Nguyen",
    email: "lan@example.com",
    phone: "",
    city: "Hanoi",
    linkedin: "",
  },
  sections: [
    {
      id: "sec-summary",
      kind: "summary",
      blocks: [{ id: "sum-1", type: "text", text: "Ships small experiments." }],
    },
  ],
}

describe("version 2 CV documents", () => {
  it("creates a block CV atomically and validates the initial document", async () => {
    const { db, client } = await createMigratedTestDb()
    try {
      const app = createTestApp(db)
      const { cookie } = await signUp(app, {
        name: "Lan",
        email: "lan-488@example.com",
      })
      const headers = authHeaders(cookie)
      const createdRes = await app.request("/api/commands/paper.create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: { kind: "cv", document: v2Fixture },
        }),
      })
      expect(createdRes.status).toBe(200)
      const created = await jsonOf(createdRes)
      const readRes = await app.request(`/api/paper/${created.data?.id}`, {
        headers,
      })
      expect((await jsonOf(readRes)).data?.document).toEqual(v2Fixture)

      const invalidRes = await app.request("/api/commands/paper.create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: { kind: "letter", document: v2Fixture },
        }),
      })
      expect(invalidRes.status).toBe(400)
      for (const document of [null, false, 0, ""]) {
        const rejected = await app.request("/api/commands/paper.create", {
          method: "POST",
          headers,
          body: JSON.stringify({ input: { kind: "cv", document } }),
        })
        expect(rejected.status).toBe(400)
      }
    } finally {
      await client.close()
    }
  })

  it("stores version 2 on create and refuses a version 1 replace", async () => {
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
    expect(created.data?.document).toEqual(blankBlockDocument())

    const readRes = await app.request(`/api/paper/${docId}`, { headers })
    expect(readRes.status).toBe(200)
    const read = await jsonOf(readRes)
    expect(read.data?.document).toEqual(blankBlockDocument())

    const rejected = await app.request("/api/commands/paper.replace", {
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
    expect(rejected.status).toBe(400)
    await expect(rejected.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "This CV uses blocks. Send a version 2 document.",
      },
    })

    const replaceRes = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: created.data?.contentVersion,
          document: v2Fixture,
        },
      }),
    })
    expect(replaceRes.status).toBe(200)
    const replaced = await jsonOf(replaceRes)
    expect(replaced.data?.document).toEqual(v2Fixture)
    await client.close()
  })

  it("reads a replaced version 2 body unchanged and rejects the other shapes", async () => {
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
    const replaceRes = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: created.data?.contentVersion,
          document: stored,
        },
      }),
    })
    expect(replaceRes.status).toBe(200)
    const replaced = (await replaceRes.json()) as {
      data?: { contentVersion?: number; document?: CvBlockDocument }
    }
    expect(replaced.data?.document).toEqual(stored)
    const readRes = await app.request(`/api/paper/${docId}`, { headers })
    const read = (await readRes.json()) as {
      data?: { document?: CvBlockDocument }
    }
    expect(read.data?.document).toEqual(stored)
    const versionAfter = replaced.data?.contentVersion

    const rejected = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: versionAfter,
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
          contentVersion: versionAfter,
          document: { version: 2, header: {} },
        },
      }),
    })
    expect(header.status).toBe(400)
    await expect(header.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "Invalid content" },
    })
    const versionLess = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: versionAfter,
          document: { name: 5 },
        },
      }),
    })
    expect(versionLess.status).toBe(400)
    await expect(versionLess.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message:
          'Invalid option: expected one of "internship"|"product"|"service"|"academic"|"photo"',
      },
    })
    await client.close()
  })

  it("refuses a version 1 body on a version 2 CV and keeps the stored document", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Lan",
      email: "lan-470-guard@example.com",
    })
    const headers = authHeaders(cookie)
    const createdRes = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { kind: "cv", name: "Lan blocks" } }),
    })
    const created = await jsonOf(createdRes)
    const docId = String(created.data?.id)
    const adopted = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: created.data?.contentVersion,
          document: v2Fixture,
        },
      }),
    })
    expect(adopted.status).toBe(200)
    const adoptedBody = await jsonOf(adopted)
    const versionAfter = adoptedBody.data?.contentVersion

    const downgrade = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: versionAfter,
          document: v1Fixture,
        },
      }),
    })
    expect(downgrade.status).toBe(400)
    await expect(downgrade.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "This CV uses blocks. Send a version 2 document.",
      },
    })

    const readRes = await app.request(`/api/paper/${docId}`, { headers })
    expect(readRes.status).toBe(200)
    const read = await jsonOf(readRes)
    expect(read.data?.document).toEqual(v2Fixture)
    expect(read.data?.contentVersion).toBe(versionAfter)
    await client.close()
  })

  it("accepts a version 2 body on a version 1 CV", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Lan",
      email: "lan-470-adopt@example.com",
    })
    const headers = authHeaders(cookie)
    const createdRes = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { kind: "cv", name: "Lan adopt" } }),
    })
    expect(createdRes.status).toBe(200)
    const created = await jsonOf(createdRes)
    expect(created.data?.document?.version).toBe(2)
    const docId = String(created.data?.id)
    await db
      .update(paperDocs)
      .set({ document: emptyCvDocument() as Record<string, unknown> })
      .where(eq(paperDocs.id, docId))
    const seeded = await app.request(`/api/paper/${docId}`, { headers })
    const seededBody = await jsonOf(seeded)
    expect(seededBody.data?.document?.version).toBeUndefined()

    const replaceRes = await app.request("/api/commands/paper.replace", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          docId,
          contentVersion: created.data?.contentVersion,
          document: v2Fixture,
        },
      }),
    })
    expect(replaceRes.status).toBe(200)
    const replaced = await jsonOf(replaceRes)
    expect(replaced.data?.document).toEqual(v2Fixture)
    expect(replaced.data?.contentVersion).toBe(
      (created.data?.contentVersion ?? 0) + 1
    )
    await client.close()
  })
})
