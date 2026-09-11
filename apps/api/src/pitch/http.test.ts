import {
  ERROR_CODES,
  PITCH_COMMANDS,
  emptyPitchDocument,
  starterCheckoutAchievement,
  starterPitchDocument,
  withStarterCheckoutAchievement,
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

    const next = { ...starterPitchDocument(), about: "Minh's about.", published: true }
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
    expect(content.storyHighlights.length).toBeGreaterThan(0)
    expect(content.bento.length).toBeGreaterThan(0)
  })

  it("restores wiped starter Moments on GET without dropping hide-persist", async () => {
    const first = await app.request("/api/pitch", {
      headers: authHeaders(cookieA),
    })
    const seeded = await json<{ ok: true; data: PitchDoc }>(first)
    const starter = starterPitchDocument()
    const wiped = {
      ...starter,
      status: "QVE134-persist-marker-1532",
      storyHighlights: [],
      bento: [],
      blocks: starter.blocks.map((block) =>
        block.kind === "moments" ? { ...block, hidden: true } : block
      ),
    }

    await db
      .update(pitchDocs)
      .set({ content: wiped })
      .where(eq(pitchDocs.id, seeded.data.id))

    const restoredRes = await app.request("/api/pitch", {
      headers: authHeaders(cookieA),
    })
    expect(restoredRes.status).toBe(200)
    const restored = await json<{ ok: true; data: PitchDoc }>(restoredRes)
    const content = restored.data.content as ReturnType<
      typeof starterPitchDocument
    >
    expect(content.storyHighlights.length).toBeGreaterThan(0)
    expect(content.bento.length).toBeGreaterThan(0)
    expect(content.bento.find((card) => card.id === "b4")).toMatchObject({
      title: "Checkout",
      body: "Hallway test setup",
    })
    expect(content.blocks.find((block) => block.kind === "moments")?.hidden).toBe(
      true
    )
    expect(content.status).toBe("QVE134-persist-marker-1532")
    expect(JSON.stringify(content)).not.toMatch(/sacred space/i)
    expect(JSON.stringify(content)).not.toMatch(/Alex Tran/i)
  })

  it("serves a published Pitch at GET /api/pitch/public/:slug without a session", async () => {
    const next = {
      ...starterPitchDocument(),
      about: "Minh's public about.",
      published: true,
    }
    const updatedRes = await postCommand(app, cookieA, PITCH_COMMANDS.update, {
      content: next,
      contentVersion: 1,
    })
    expect(updatedRes.status).toBe(200)

    const publicRes = await app.request("/api/pitch/public/minh")
    expect(publicRes.status).toBe(200)
    const body = await json<{
      ok: true
      data: {
        slug: string
        author: { name: string; email: string; image: string | null }
        content: ReturnType<typeof starterPitchDocument>
      }
    }>(publicRes)
    expect(body.data.slug).toBe("minh")
    expect(body.data.author).toEqual({
      name: userA.name,
      email: userA.email,
      image: null,
    })
    expect(body.data.content.about).toBe("Minh's public about.")
    expect(body.data.content.published).toBe(true)
  })

  it("returns 404 for an unpublished or unknown public slug", async () => {
    const unpublished = await app.request("/api/pitch/public/lan")
    expect(unpublished.status).toBe(404)
    await expect(unpublished.json()).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: "Pitch not found" },
    })

    const unknown = await app.request("/api/pitch/public/no-such-user")
    expect(unknown.status).toBe(404)

    const invalid = await app.request("/api/pitch/public/Minh")
    expect(invalid.status).toBe(404)

    const unpublishedMine = await postCommand(
      app,
      cookieA,
      PITCH_COMMANDS.update,
      {
        content: { ...starterPitchDocument(), published: false },
        contentVersion: 1,
      }
    )
    expect(unpublishedMine.status).toBe(200)
    const gone = await app.request("/api/pitch/public/minh")
    expect(gone.status).toBe(404)
  })

  it("keeps starter highlights gone after Clear demo then a real About", async () => {
    const scout = await signUp(app, {
      name: "Scout 250",
      email: "scout250+clear-about@example.com",
      password: "correct-horse-battery",
    })

    const seeded = await json<{ ok: true; data: PitchDoc }>(
      await app.request("/api/pitch", { headers: authHeaders(scout.cookie) })
    )
    const starter = starterPitchDocument()
    expect(
      (seeded.data.content as ReturnType<typeof starterPitchDocument>)
        .storyHighlights.length
    ).toBeGreaterThan(0)

    const clearedRes = await postCommand(app, scout.cookie, PITCH_COMMANDS.update, {
      content: emptyPitchDocument(),
      contentVersion: 1,
    })
    expect(clearedRes.status).toBe(200)
    const cleared = await json<{ ok: true; data: PitchDoc }>(clearedRes)
    const clearedContent = cleared.data.content as ReturnType<
      typeof emptyPitchDocument
    >
    expect(clearedContent.storyHighlights).toEqual([])
    expect(clearedContent.bento).toEqual([])
    expect(JSON.stringify(clearedContent)).not.toMatch(/Checkout/)
    expect(JSON.stringify(clearedContent)).not.toMatch(/Wallet audit/)
    expect(JSON.stringify(clearedContent)).not.toMatch(/Club sprint/)

    const typed = {
      ...emptyPitchDocument(),
      about: "I ship small checkout studies.",
    }
    const typedRes = await postCommand(app, scout.cookie, PITCH_COMMANDS.update, {
      content: typed,
      contentVersion: 1,
    })
    expect(typedRes.status).toBe(200)

    const reread = await json<{ ok: true; data: PitchDoc }>(
      await app.request("/api/pitch", { headers: authHeaders(scout.cookie) })
    )
    const content = reread.data.content as ReturnType<typeof emptyPitchDocument>
    expect(content.about).toBe("I ship small checkout studies.")
    expect(content.storyHighlights).toEqual([])
    expect(content.bento).toEqual([])
    expect(content.blocks.find((block) => block.kind === "moments")?.hidden).toBe(
      true
    )
    expect(JSON.stringify(content)).not.toMatch(/Checkout/)
    expect(JSON.stringify(content)).not.toMatch(/Wallet audit/)
    expect(JSON.stringify(content)).not.toMatch(/Club sprint/)
    expect(JSON.stringify(content)).not.toMatch(/campus club/i)
    expect(JSON.stringify(content)).not.toMatch(/\+18%/)
    expect(content.storyHighlights).not.toEqual(starter.storyHighlights)

    const leakedRes = await postCommand(app, scout.cookie, PITCH_COMMANDS.update, {
      content: {
        ...emptyPitchDocument(),
        demo: true,
        about: "I ship small checkout studies.",
      },
      contentVersion: 1,
    })
    expect(leakedRes.status).toBe(200)
    const leaked = await json<{ ok: true; data: PitchDoc }>(leakedRes)
    const leakedContent = leaked.data.content as ReturnType<
      typeof emptyPitchDocument
    >
    expect(leakedContent.storyHighlights).toEqual([])
    expect(leakedContent.bento).toEqual([])
    expect(JSON.stringify(leakedContent)).not.toMatch(/Wallet audit/)
    expect(JSON.stringify(leakedContent)).not.toMatch(/Club sprint/)
  })

  it("persists a User-added checkout Proof after Clear demo", async () => {
    const scout = await signUp(app, {
      name: "Scout 220",
      email: "scout220+add-proof@example.com",
      password: "correct-horse-battery",
    })

    const clearedRes = await postCommand(app, scout.cookie, PITCH_COMMANDS.update, {
      content: emptyPitchDocument(),
      contentVersion: 1,
    })
    expect(clearedRes.status).toBe(200)

    const added = withStarterCheckoutAchievement(emptyPitchDocument())
    const addedRes = await postCommand(app, scout.cookie, PITCH_COMMANDS.update, {
      content: added,
      contentVersion: 1,
    })
    expect(addedRes.status).toBe(200)

    const reread = await json<{ ok: true; data: PitchDoc }>(
      await app.request("/api/pitch", { headers: authHeaders(scout.cookie) })
    )
    const content = reread.data.content as ReturnType<typeof emptyPitchDocument>
    expect(content.achievements).toEqual([starterCheckoutAchievement()])
    expect(content.achievements[0]?.proofId).toBe("checkout")
    expect(content.headline).toBe("Proof on this page — replace with your story")
    expect(content.demo).toBe(false)
    expect(content.storyHighlights).toEqual([])
    expect(content.bento).toEqual([])
    expect(JSON.stringify(content.achievements)).not.toMatch(/"#"/)
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
