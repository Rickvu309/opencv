import {
  ERROR_CODES,
  PITCH_COMMANDS,
  emptyPitchDocument,
  starterPitchDocument,
  type PitchDoc,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import { pitchDocs } from "../db/schema.js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

const userA = {
  name: "Minh",
  email: "minh-pitch@example.com",
  password: "correct-horse-battery",
}
const userB = {
  name: "Lan",
  email: "lan-pitch@example.com",
  password: "correct-horse-battery",
}

async function postCommand(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  name: string,
  body: unknown
) {
  return app.request(`/api/commands/${name}`, {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify(body),
  })
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

describe("pitch API", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let app: ReturnType<typeof createTestApp>
  let cookieA: string
  let cookieB: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    app = createTestApp(migrated.db)
    cookieA = (await signUp(app, userA)).cookie
    cookieB = (await signUp(app, userB)).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("requires a session on reads and mutations", async () => {
    const read = await app.request("/api/pitch")
    expect(read.status).toBe(401)
    await expect(read.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required",
      },
    })

    const command = await app.request(`/api/commands/${PITCH_COMMANDS.update}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: emptyPitchDocument(),
        contentVersion: 1,
      }),
    })
    expect(command.status).toBe(401)
  })

  it("does not expose a write path besides POST /api/commands/:name", async () => {
    const create = await app.request("/api/pitch", {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({ content: emptyPitchDocument() }),
    })
    expect(create.status).toBe(404)

    const remove = await app.request("/api/pitch", {
      method: "DELETE",
      headers: authHeaders(cookieA),
    })
    expect(remove.status).toBe(404)
  })

  it("returns the seeded Pitch and persists edits through the Command", async () => {
    const first = await app.request("/api/pitch", {
      headers: authHeaders(cookieA),
    })
    expect(first.status).toBe(200)
    const seeded = await json<{ ok: true; data: PitchDoc }>(first)
    expect(seeded.data.kind).toBe("pitch")
    expect(seeded.data.contentVersion).toBe(1)

    const next = { ...emptyPitchDocument(), about: "Minh's about.", published: true }
    const updatedRes = await postCommand(app, cookieA, PITCH_COMMANDS.update, {
      content: next,
      contentVersion: 1,
    })
    expect(updatedRes.status).toBe(200)
    const updated = await json<{ ok: true; data: PitchDoc }>(updatedRes)
    expect(updated.data.id).toBe(seeded.data.id)
    expect(updated.data.content).toEqual(next)

    const reread = await app.request("/api/pitch", {
      headers: authHeaders(cookieA),
    })
    const again = await json<{ ok: true; data: PitchDoc }>(reread)
    expect(again.data.content).toEqual(next)

    const other = await app.request("/api/pitch", {
      headers: authHeaders(cookieB),
    })
    const otherDoc = await json<{ ok: true; data: PitchDoc }>(other)
    expect(otherDoc.data.id).not.toBe(seeded.data.id)
    expect(otherDoc.data.content).not.toEqual(next)
  })

  it("repairs persisted sacred-space and leftover persona copy on GET", async () => {
    const first = await app.request("/api/pitch", {
      headers: authHeaders(cookieA),
    })
    const seeded = await json<{ ok: true; data: PitchDoc }>(first)
    const starter = starterPitchDocument()
    const leftover = {
      ...starter,
      github: { username: "alex-tran-uit", connected: true },
      bento: starter.bento.map((card) => {
        if (card.id === "b1") return { ...card, title: "Alex Tran" }
        if (card.id === "b4") {
          return {
            ...card,
            title: "my sacred space",
            body: "Hallway test · late night Figma",
            storyHighlightId: "sh-checkout",
          }
        }
        return card
      }),
    }

    await db
      .update(pitchDocs)
      .set({ content: leftover })
      .where(eq(pitchDocs.id, seeded.data.id))

    const repairedRes = await app.request("/api/pitch", {
      headers: authHeaders(cookieA),
    })
    expect(repairedRes.status).toBe(200)
    const repaired = await json<{ ok: true; data: PitchDoc }>(repairedRes)
    const content = repaired.data.content as ReturnType<
      typeof starterPitchDocument
    >
    expect(content.bento.find((card) => card.id === "b4")).toMatchObject({
      title: "Checkout",
      body: "Hallway test setup",
      storyHighlightId: "sh-checkout",
    })
    expect(content.bento.find((card) => card.id === "b1")?.title).toBe(
      "Your name"
    )
    expect(content.github.username).toBe("")
    expect(JSON.stringify(content)).not.toMatch(/sacred space/i)
    expect(JSON.stringify(content)).not.toMatch(/Alex Tran/i)
  })

  it("rejects malformed content", async () => {
    const bad = await postCommand(app, cookieA, PITCH_COMMANDS.update, {
      content: { markdown: "nope" },
      contentVersion: 1,
    })
    expect(bad.status).toBe(400)
    await expect(bad.json()).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    })
  })
})
