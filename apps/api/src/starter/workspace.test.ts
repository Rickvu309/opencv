import {
  PAPER_COMMANDS,
  STARTER_CV_NAME,
  STARTER_THREAD_TITLE,
  type ApplyCard,
  type PaperDoc,
  type PitchDoc,
  type ThreadDetail,
  type ThreadListItem,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { user as userTable } from "../db/schema.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { seedStarterWorkspace } from "./workspace.js"

const PERSONA = /Eric Nguyen|\bEric\b|Alex Tran/i

function expectNoFit(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(/"fit"/)
}

describe("seedStarterWorkspace", () => {
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    db = migrated.db
    client = migrated.client

    await db.insert(userTable).values({
      id: "starter-user",
      name: "Minh",
      email: "starter-direct@example.com",
      emailVerified: false,
      createdAt: new Date("2026-08-25T12:00:00.000Z"),
      updatedAt: new Date("2026-08-25T12:00:00.000Z"),
    })
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("writes one CV, cards across Stages, one Coach Thread, and one Pitch", async () => {
    const now = new Date("2026-08-25T12:00:00.000Z")
    const first = await seedStarterWorkspace(db, "starter-user", now)

    expect(first.created).toBe(true)
    expect(first.paperDocId).toMatch(/^[0-9a-f-]{36}$/)
    expect(first.applyCardIds).toHaveLength(4)
    expect(first.threadId).toMatch(/^[0-9a-f-]{36}$/)
    expect(first.pitchDocId).toMatch(/^[0-9a-f-]{36}$/)

    const second = await seedStarterWorkspace(db, "starter-user", now)
    expect(second).toEqual({
      created: false,
      paperDocId: null,
      applyCardIds: [],
      threadId: null,
      pitchDocId: null,
    })
  })
})

describe("signup seeds the starter workspace", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let app: ReturnType<typeof createTestApp>
  let cookie: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    app = createTestApp(migrated.db)
    cookie = (
      await signUp(app, {
        name: "Minh",
        email: "starter-signup@example.com",
        password: "correct-horse-battery",
      })
    ).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("shows the sample workspace and never a demo persona", async () => {
    const headers = authHeaders(cookie)

    const paperRes = await app.request("/api/paper", { headers })
    expect(paperRes.status).toBe(200)
    const paper = (await paperRes.json()) as { ok: true; data: PaperDoc[] }
    expect(paper.data).toHaveLength(1)
    expect(paper.data[0]!.name).toBe(STARTER_CV_NAME)
    expect(paper.data[0]!.kind).toBe("cv")
    expect(JSON.stringify(paper.data)).not.toMatch(PERSONA)
    expect(JSON.stringify(paper.data)).not.toMatch(/cv:v1:|proof:v1:/)

    const applyRes = await app.request("/api/apply", { headers })
    expect(applyRes.status).toBe(200)
    const apply = (await applyRes.json()) as { ok: true; data: ApplyCard[] }
    expect(apply.data.map((card) => card.stage).sort()).toEqual([
      "closed",
      "inbox",
      "prep",
      "sent",
    ])
    expectNoFit(apply)
    expect(JSON.stringify(apply.data)).not.toMatch(PERSONA)
    expect(apply.data.every((card) => card.jobUrl === null)).toBe(true)
    expect(apply.data.every((card) => card.demo === true)).toBe(true)
    expect(JSON.stringify(apply.data)).not.toMatch(/example\.com/i)

    const listRes = await app.request("/api/threads", { headers })
    expect(listRes.status).toBe(200)
    const list = (await listRes.json()) as { ok: true; data: ThreadListItem[] }
    expect(list.data).toHaveLength(1)
    expect(list.data[0]!.title).toBe(STARTER_THREAD_TITLE)

    const detailRes = await app.request(`/api/threads/${list.data[0]!.id}`, {
      headers,
    })
    expect(detailRes.status).toBe(200)
    const detail = (await detailRes.json()) as { ok: true; data: ThreadDetail }
    expect(detail.data.messages).toHaveLength(1)
    expect(detail.data.messages[0]!.role).toBe("coach")
    expect(detail.data.messages[0]!.text).toContain("haven't run any Commands")
    expect(detail.data.messages[0]!.text).not.toMatch(PERSONA)

    const pitchRes = await app.request("/api/pitch", { headers })
    expect(pitchRes.status).toBe(200)
    const pitch = (await pitchRes.json()) as { ok: true; data: PitchDoc }
    expect(pitch.data.kind).toBe("pitch")
    expect(pitch.data.contentVersion).toBe(1)
    expect(pitch.data.content).toMatchObject({
      demo: true,
      headline: "Sample Pitch · replace with your story",
    })
    expect(JSON.stringify(pitch.data)).not.toMatch(/Aspiring product manager/i)
    expect(JSON.stringify(pitch.data)).not.toMatch(PERSONA)
  })

  it("lets the User wipe the sample CV through the command door", async () => {
    const headers = authHeaders(cookie)
    const paper = (await (
      await app.request("/api/paper", { headers })
    ).json()) as { ok: true; data: PaperDoc[] }
    const sample = paper.data.find((doc) => doc.name === STARTER_CV_NAME)
    expect(sample).toBeDefined()

    const deleted = await app.request(
      `/api/commands/${PAPER_COMMANDS.deleteDoc}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ docId: sample!.id }),
      }
    )
    expect(deleted.status).toBe(200)

    const after = (await (
      await app.request("/api/paper", { headers })
    ).json()) as { ok: true; data: PaperDoc[] }
    expect(after.data.map((doc) => doc.id)).not.toContain(sample!.id)
  })
})
