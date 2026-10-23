import {
  APPLY_COMMANDS,
  APPLY_SCAN_FETCH_FAILED,
  APPLY_SCAN_NOT_FOUND,
  APPLY_SCAN_UNAVAILABLE,
  ERROR_CODES,
  PAPER_COMMANDS,
  type ApplyCard,
  type ApplyScanResult,
  type PaperDoc,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDemoCoachRuntime, withScanJobPosting } from "../coach/fake.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

const userA = {
  name: "Minh",
  email: "minh-apply@example.com",
  password: "correct-horse-battery",
}
const userScan = {
  name: "Minh",
  email: "minh-apply-scan@example.com",
  password: "correct-horse-battery",
}
const userB = {
  name: "Lan",
  email: "lan-apply@example.com",
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

function expectNoFit(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(/"fit"/)
}

let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
let sharedDb: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]

beforeAll(async () => {
  const migrated = await createMigratedTestDb()
  client = migrated.client
  sharedDb = migrated.db
}, 60_000)

afterAll(async () => {
  await client.close()
})

describe("apply API", () => {
  let app: ReturnType<typeof createTestApp>
  let cookieA: string
  let cookieB: string

  beforeAll(async () => {
    app = createTestApp(sharedDb)
    cookieA = (await signUp(app, userA)).cookie
    cookieB = (await signUp(app, userB)).cookie
  })

  it("requires a session on reads and mutations", async () => {
    const list = await app.request("/api/apply")
    expect(list.status).toBe(401)
    await expect(list.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required",
      },
    })

    const command = await app.request(
      `/api/commands/${APPLY_COMMANDS.createCard}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Role" }),
      }
    )
    expect(command.status).toBe(401)
  })

  it("does not expose a write path besides POST /api/commands/:name", async () => {
    const create = await app.request("/api/apply", {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({ title: "Role" }),
    })
    expect(create.status).toBe(404)

    const remove = await app.request("/api/apply/not-a-route", {
      method: "DELETE",
      headers: authHeaders(cookieA),
    })
    expect(remove.status).toBe(404)
  })

  it("round-trips create, move, star, update, list, read, and delete without fit", async () => {
    const createdRes = await postCommand(
      app,
      cookieA,
      APPLY_COMMANDS.createCard,
      {
        title: "Associate PM intern",
        company: "Local startup",
        stage: "inbox",
        trackDate: "2026-08-26",
        trackKind: "followup",
      }
    )
    expect(createdRes.status).toBe(200)
    const created = await json<{ ok: true; data: ApplyCard }>(createdRes)
    expect(created.data.title).toBe("Associate PM intern")
    expect(created.data.demo).toBe(false)
    expectNoFit(created)

    const movedRes = await postCommand(app, cookieA, APPLY_COMMANDS.moveCard, {
      cardId: created.data.id,
      stage: "prep",
    })
    expect(movedRes.status).toBe(200)
    const moved = await json<{ ok: true; data: ApplyCard }>(movedRes)
    expect(moved.data.stage).toBe("prep")
    expectNoFit(moved)

    const starredRes = await postCommand(
      app,
      cookieA,
      APPLY_COMMANDS.toggleStar,
      { cardId: created.data.id }
    )
    expect(
      (await json<{ ok: true; data: ApplyCard }>(starredRes)).data.starred
    ).toBe(true)

    const updatedRes = await postCommand(
      app,
      cookieA,
      APPLY_COMMANDS.updateCard,
      { cardId: created.data.id, note: "Prep discovery notes" }
    )
    expect(
      (await json<{ ok: true; data: ApplyCard }>(updatedRes)).data.note
    ).toBe("Prep discovery notes")

    const listRes = await app.request("/api/apply", {
      headers: authHeaders(cookieA),
    })
    expect(listRes.status).toBe(200)
    const list = await json<{ ok: true; data: ApplyCard[] }>(listRes)
    expect(list.data.map((card) => card.id)).toContain(created.data.id)
    expectNoFit(list)

    const detailRes = await app.request(`/api/apply/${created.data.id}`, {
      headers: authHeaders(cookieA),
    })
    expect(detailRes.status).toBe(200)
    const detail = await json<{ ok: true; data: ApplyCard }>(detailRes)
    expect(detail.data.stage).toBe("prep")
    expectNoFit(detail)

    const deletedRes = await postCommand(
      app,
      cookieA,
      APPLY_COMMANDS.deleteCard,
      { cardId: created.data.id }
    )
    expect(deletedRes.status).toBe(200)
    await expect(deletedRes.json()).resolves.toEqual({
      ok: true,
      data: { id: created.data.id },
    })

    const afterDelete = await app.request(`/api/apply/${created.data.id}`, {
      headers: authHeaders(cookieA),
    })
    expect(afterDelete.status).toBe(404)
  })

  it("links a Paper doc to an Apply card over HTTP", async () => {
    const cardRes = await postCommand(app, cookieA, APPLY_COMMANDS.createCard, {
      title: "UX intern",
      company: "Agency",
    })
    const card = (await json<{ ok: true; data: ApplyCard }>(cardRes)).data
    const docRes = await postCommand(app, cookieA, PAPER_COMMANDS.createDoc, {
      kind: "letter",
      name: "Cover: Agency",
    })
    const doc = (await json<{ ok: true; data: PaperDoc }>(docRes)).data

    const linkedRes = await postCommand(
      app,
      cookieA,
      PAPER_COMMANDS.linkApplyCard,
      { docId: doc.id, applyCardId: card.id }
    )
    expect(linkedRes.status).toBe(200)
    const linked = await json<{ ok: true; data: PaperDoc }>(linkedRes)
    expect(linked.data.applyCardId).toBe(card.id)
    expectNoFit(linked)

    const paperList = await json<{ ok: true; data: PaperDoc[] }>(
      await app.request("/api/paper", { headers: authHeaders(cookieA) })
    )
    expect(paperList.data.find((item) => item.id === doc.id)?.applyCardId).toBe(
      card.id
    )
    expectNoFit(paperList)
  })

  it("keeps user B off user A's Apply cards", async () => {
    const createdRes = await postCommand(
      app,
      cookieA,
      APPLY_COMMANDS.createCard,
      { title: "A only", company: "Private" }
    )
    const cardId = (await json<{ ok: true; data: ApplyCard }>(createdRes)).data
      .id

    const listB = await app.request("/api/apply", {
      headers: authHeaders(cookieB),
    })
    const listed = await json<{ ok: true; data: ApplyCard[] }>(listB)
    expect(listed.data.map((card) => card.id)).not.toContain(cardId)

    const readB = await app.request(`/api/apply/${cardId}`, {
      headers: authHeaders(cookieB),
    })
    expect(readB.status).toBe(403)

    const mutateB = await postCommand(app, cookieB, APPLY_COMMANDS.toggleStar, {
      cardId,
    })
    expect(mutateB.status).toBe(403)
  })
})

describe("POST /api/apply/scan", () => {
  let cookie: string
  let app: ReturnType<typeof createTestApp>

  beforeAll(async () => {
    app = createTestApp(sharedDb, {
      coach: withScanJobPosting(
        createDemoCoachRuntime(),
        async ({ postingText }) =>
          JSON.stringify({
            title: postingText.includes("Associate PM intern")
              ? "Associate PM intern"
              : null,
            company: postingText.includes("Local startup")
              ? "Local startup"
              : null,
            note: postingText.includes("Hanoi") ? "Hanoi" : null,
          })
      ),
      fetchJobPosting: async () => ({
        ok: true,
        text: "<p>Local startup is hiring an Associate PM intern in Hanoi.</p>",
      }),
    })
    cookie = (await signUp(app, userScan)).cookie
  })

  it("requires a session", async () => {
    const res = await app.request("/api/apply/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jdText: "Role at Company" }),
    })
    expect(res.status).toBe(401)
  })

  it("scans pasted JD and does not write an Apply card", async () => {
    const before = await json<{ ok: true; data: ApplyCard[] }>(
      await app.request("/api/apply", { headers: authHeaders(cookie) })
    )
    const res = await app.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        jdText: "Local startup is hiring an Associate PM intern in Hanoi.",
      }),
    })
    expect(res.status).toBe(200)
    const body = await json<{ ok: true; data: ApplyScanResult }>(res)
    expect(body.data).toEqual({
      title: "Associate PM intern",
      company: "Local startup",
      note: "Hanoi",
    })

    const after = await json<{ ok: true; data: ApplyCard[] }>(
      await app.request("/api/apply", { headers: authHeaders(cookie) })
    )
    expect(after.data).toHaveLength(before.data.length)
  })

  it("scans a posting URL through the injected fetch", async () => {
    const res = await app.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ jobUrl: "https://careers.example.com/pm-intern" }),
    })
    expect(res.status).toBe(200)
    const body = await json<{ ok: true; data: ApplyScanResult }>(res)
    expect(body.data.title).toBe("Associate PM intern")
    expect(body.data.company).toBe("Local startup")
  })

  it("honest-fails when the post has no title or company", async () => {
    const res = await app.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ jdText: "Come work with us. Nice people." }),
    })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: APPLY_SCAN_NOT_FOUND,
      },
    })
  })
})

describe("POST /api/apply/scan labeled JD twice (QVE-232)", () => {
  it("fills the same labeled JD twice when the model is empty", async () => {
    const localApp = createTestApp(sharedDb, {
      coach: withScanJobPosting(createDemoCoachRuntime(), async () => "{}"),
    })
    const { cookie } = await signUp(localApp, {
      name: "Mai",
      email: "mai-apply-scan-labeled@example.com",
      password: "correct-horse-battery",
    })
    const jdText = [
      "Job Title: Café Barista Lead",
      "Company: Highlands Coffee",
      "Location: District 1, Ho Chi Minh City",
      "We need a café lead who owns the morning rush and trains new baristas.",
    ].join("\n")

    const first = await localApp.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ jdText }),
    })
    const second = await localApp.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ jdText: `${jdText} ` }),
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const firstBody = await json<{ ok: true; data: ApplyScanResult }>(first)
    const secondBody = await json<{ ok: true; data: ApplyScanResult }>(second)
    expect(firstBody.data).toEqual({
      title: "Café Barista Lead",
      company: "Highlands Coffee",
      note: "District 1, Ho Chi Minh City",
    })
    expect(secondBody.data).toEqual(firstBody.data)
  })
})

describe("POST /api/apply/scan paste JD after unread URL (QVE-251)", () => {
  it("fills hiring prose when the model is empty and does not fetch the dead URL", async () => {
    let fetches = 0
    const localApp = createTestApp(sharedDb, {
      coach: withScanJobPosting(createDemoCoachRuntime(), async () => "{}"),
      fetchJobPosting: async () => {
        fetches += 1
        throw new Error("must not fetch when job text is pasted")
      },
    })
    const { cookie } = await signUp(localApp, {
      name: "Mai",
      email: "mai-apply-scan-paste-after-unread@example.com",
      password: "correct-horse-battery",
    })
    const res = await localApp.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        jobUrl: "https://jobs.careers.microsoft.com/global/en/job/missing",
        jdText:
          "Local startup is hiring an Associate PM intern in Hanoi. Apply by 12 September.",
      }),
    })
    expect(res.status).toBe(200)
    expect(fetches).toBe(0)
    const body = await json<{ ok: true; data: ApplyScanResult }>(res)
    expect(body.data).toEqual({
      title: "Associate PM intern",
      company: "Local startup",
      note: "Hanoi",
    })
  })
})

describe("POST /api/apply/scan unreadable fetch (QVE-249)", () => {
  it("honest-fails a Page not found shell and does not write a card", async () => {
    const localApp = createTestApp(sharedDb, {
      coach: withScanJobPosting(createDemoCoachRuntime(), async () =>
        JSON.stringify({
          title: null,
          company: "Microsoft",
          note: "Page not found",
        })
      ),
      fetchJobPosting: async () => ({
        ok: true,
        text: "<h1>Page not found</h1><p>Microsoft Careers</p>",
      }),
    })
    const { cookie } = await signUp(localApp, {
      name: "Mai",
      email: "mai-apply-scan-unreadable@example.com",
      password: "correct-horse-battery",
    })
    const before = await json<{ ok: true; data: ApplyCard[] }>(
      await localApp.request("/api/apply", { headers: authHeaders(cookie) })
    )
    const res = await localApp.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        jobUrl: "https://jobs.careers.microsoft.com/global/en/job/missing",
      }),
    })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: APPLY_SCAN_FETCH_FAILED,
      },
    })
    const after = await json<{ ok: true; data: ApplyCard[] }>(
      await localApp.request("/api/apply", { headers: authHeaders(cookie) })
    )
    expect(after.data).toHaveLength(before.data.length)
  })
})

describe("POST /api/apply/scan without a scan runtime", () => {
  it("fills café hiring prose without inventing fields", async () => {
    const localApp = createTestApp(sharedDb)
    const { cookie } = await signUp(localApp, {
      name: "Mai",
      email: "mai-apply-scan@example.com",
      password: "correct-horse-battery",
    })
    const res = await localApp.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        jdText: "Local startup is hiring an Associate PM intern.",
      }),
    })
    expect(res.status).toBe(200)
    const body = await json<{ ok: true; data: ApplyScanResult }>(res)
    expect(body.data).toEqual({
      title: "Associate PM intern",
      company: "Local startup",
      note: null,
    })
  })

  it("honest-fails garbage JD instead of inventing fields", async () => {
    const localApp = createTestApp(sharedDb)
    const { cookie } = await signUp(localApp, {
      name: "Mai",
      email: "mai-apply-scan-garbage@example.com",
      password: "correct-horse-battery",
    })
    const res = await localApp.request("/api/apply/scan", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        jdText: "Come work with us. Nice people.",
      }),
    })
    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.COACH_UNAVAILABLE,
        message: APPLY_SCAN_UNAVAILABLE,
      },
    })
  })
})
