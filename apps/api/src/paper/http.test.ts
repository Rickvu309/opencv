import {
  ERROR_CODES,
  PAPER_COMMANDS,
  emptyCvDocument,
  type PaperDoc,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

const userA = {
  name: "Minh",
  email: "minh-paper@example.com",
  password: "correct-horse-battery",
}
const userB = {
  name: "Lan",
  email: "lan-paper@example.com",
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

describe("paper API", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let app: ReturnType<typeof createTestApp>
  let cookieA: string
  let cookieB: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    app = createTestApp(migrated.db)
    cookieA = (await signUp(app, userA)).cookie
    cookieB = (await signUp(app, userB)).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("requires a session on reads and mutations", async () => {
    const list = await app.request("/api/paper")
    expect(list.status).toBe(401)
    await expect(list.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required",
      },
    })

    const command = await app.request(
      `/api/commands/${PAPER_COMMANDS.createDoc}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "cv" }),
      }
    )
    expect(command.status).toBe(401)
  })

  it("does not expose a write path besides POST /api/commands/:name", async () => {
    const create = await app.request("/api/paper", {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({ kind: "cv" }),
    })
    expect(create.status).toBe(404)

    const remove = await app.request("/api/paper/not-a-route", {
      method: "DELETE",
      headers: authHeaders(cookieA),
    })
    expect(remove.status).toBe(404)
  })

  it("round-trips create, edit, rename, status, list, read, and delete", async () => {
    const kinds = ["cv", "letter", "proof"] as const
    const createdIds: string[] = []

    for (const kind of kinds) {
      const createdRes = await postCommand(
        app,
        cookieA,
        PAPER_COMMANDS.createDoc,
        { kind, name: `${kind} draft` }
      )
      expect(createdRes.status).toBe(200)
      const created = await json<{ ok: true; data: PaperDoc }>(createdRes)
      expect(created.data.kind).toBe(kind)
      expect(created.data.contentVersion).toBe(1)
      createdIds.push(created.data.id)

      const content =
        kind === "cv"
          ? { ...emptyCvDocument(), name: "Edited CV" }
          : kind === "letter"
            ? { markdown: "Edited letter" }
            : {
                viewMode: "timeline" as const,
                title: "Edited proof",
                steps: [],
              }

      const updatedRes = await postCommand(
        app,
        cookieA,
        PAPER_COMMANDS.updateContent,
        {
          docId: created.data.id,
          content,
          contentVersion: 1,
        }
      )
      expect(updatedRes.status).toBe(200)
      const updated = await json<{ ok: true; data: PaperDoc }>(updatedRes)
      expect(updated.data.content).toEqual(content)

      const renamedRes = await postCommand(
        app,
        cookieA,
        PAPER_COMMANDS.renameDoc,
        { docId: created.data.id, name: `${kind} renamed` }
      )
      expect(renamedRes.status).toBe(200)
      expect(
        (await json<{ ok: true; data: PaperDoc }>(renamedRes)).data.name
      ).toBe(`${kind} renamed`)

      const statusRes = await postCommand(
        app,
        cookieA,
        PAPER_COMMANDS.setStatus,
        { docId: created.data.id, status: "ready" }
      )
      expect(statusRes.status).toBe(200)
      expect(
        (await json<{ ok: true; data: PaperDoc }>(statusRes)).data.status
      ).toBe("ready")
    }

    const listRes = await app.request("/api/paper", {
      headers: authHeaders(cookieA),
    })
    expect(listRes.status).toBe(200)
    const list = await json<{ ok: true; data: PaperDoc[] }>(listRes)
    expect(list.data).toHaveLength(3)
    expect(list.data.every((doc) => typeof doc.content === "object")).toBe(true)
    expect(JSON.stringify(list.data)).not.toMatch(/cv:v1:|proof:v1:/)

    const detailRes = await app.request(`/api/paper/${createdIds[0]}`, {
      headers: authHeaders(cookieA),
    })
    expect(detailRes.status).toBe(200)
    const detail = await json<{ ok: true; data: PaperDoc }>(detailRes)
    expect(detail.data.id).toBe(createdIds[0])

    const deletedRes = await postCommand(
      app,
      cookieA,
      PAPER_COMMANDS.deleteDoc,
      { docId: createdIds[2] }
    )
    expect(deletedRes.status).toBe(200)
    await expect(deletedRes.json()).resolves.toEqual({
      ok: true,
      data: { id: createdIds[2] },
    })

    const afterDelete = await app.request(`/api/paper/${createdIds[2]}`, {
      headers: authHeaders(cookieA),
    })
    expect(afterDelete.status).toBe(404)
    await expect(afterDelete.json()).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: "Paper doc not found" },
    })
  })

  it("keeps user B off user A's Paper docs", async () => {
    const createdRes = await postCommand(
      app,
      cookieA,
      PAPER_COMMANDS.createDoc,
      { kind: "letter", name: "A only" }
    )
    const docId = (await json<{ ok: true; data: PaperDoc }>(createdRes)).data.id

    const listB = await app.request("/api/paper", {
      headers: authHeaders(cookieB),
    })
    const listed = await json<{ ok: true; data: PaperDoc[] }>(listB)
    expect(listed.data.map((doc) => doc.id)).not.toContain(docId)

    const readB = await app.request(`/api/paper/${docId}`, {
      headers: authHeaders(cookieB),
    })
    expect(readB.status).toBe(403)
    await expect(readB.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: "You cannot access this Paper doc",
      },
    })

    const mutateB = await postCommand(app, cookieB, PAPER_COMMANDS.renameDoc, {
      docId,
      name: "stolen",
    })
    expect(mutateB.status).toBe(403)
  })

  it("returns the documented envelopes for unknown command and bad input", async () => {
    const unknown = await postCommand(app, cookieA, "paper.explode", {})
    expect(unknown.status).toBe(404)
    await expect(unknown.json()).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.UNKNOWN_COMMAND, message: "Unknown command" },
    })

    const bad = await postCommand(app, cookieA, PAPER_COMMANDS.updateContent, {
      docId: "nope",
      content: {},
      contentVersion: 1,
    })
    expect(bad.status).toBe(400)
    const body = await json<{ ok: false; error: { code: string } }>(bad)
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })
})
