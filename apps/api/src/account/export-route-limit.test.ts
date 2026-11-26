import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { LIMITS } from "@workspace/domain/limits"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

const spec = LIMITS["export.running"]
const EXPORT_ACCOUNT_BUSY = spec.says.key
const EXPORT_SERVICE_BUSY = spec.says.service
const EXPORTS_AT_ONCE = spec.shape.kind === "lease" ? spec.shape.total : 0

type Database = Awaited<ReturnType<typeof createMigratedTestDb>>

let database: Database
let app: ReturnType<typeof createTestApp>
const cookies: string[] = []

function requestExport(cookie: string) {
  return app.request("/api/account/export", { headers: authHeaders(cookie) })
}

beforeAll(async () => {
  database = await createMigratedTestDb()
  app = createTestApp(database.db)
  for (const index of [0, 1, 2, 3]) {
    const { cookie } = await signUp(app, {
      name: `Exporter ${index}`,
      email: `exporter-${index}@example.com`,
    })
    cookies.push(cookie)
  }
})

afterAll(async () => {
  await database.client.close()
})

describe("account export limits on the route", () => {
  it("runs exactly one of 20 exports sent at once from one account", async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => requestExport(cookies[0]!))
    )
    const statuses = responses.map((res) => res.status)
    expect(statuses.filter((status) => status === 200)).toHaveLength(1)
    expect(statuses.filter((status) => status === 429)).toHaveLength(19)
    const refused = responses.find((res) => res.status === 429)!
    expect(refused.headers.get("retry-after")).toBe("30")
    expect(refused.headers.get("x-limit")).toBe("export.running")
    expect(await refused.json()).toMatchObject({
      error: { message: EXPORT_ACCOUNT_BUSY },
    })
    await responses.find((res) => res.status === 200)!.arrayBuffer()
    const after = await requestExport(cookies[0]!)
    expect(after.status).toBe(200)
    await after.arrayBuffer()
  })

  it("never runs more exports across accounts than the ceiling", async () => {
    const responses = await Promise.all(cookies.map(requestExport))
    const statuses = responses.map((res) => res.status)
    expect(statuses.filter((status) => status === 200)).toHaveLength(
      EXPORTS_AT_ONCE
    )
    expect(statuses.filter((status) => status === 503)).toHaveLength(
      cookies.length - EXPORTS_AT_ONCE
    )
    const refused = responses.find((res) => res.status === 503)!
    expect(refused.headers.get("retry-after")).toBe("30")
    expect(refused.headers.get("x-limit")).toBe("export.running")
    expect(await refused.json()).toMatchObject({
      error: { message: EXPORT_SERVICE_BUSY },
    })
    await Promise.all(
      responses
        .filter((res) => res.status === 200)
        .map((res) => res.arrayBuffer())
    )
    const retried = await requestExport(cookies[statuses.indexOf(503)]!)
    expect(retried.status).toBe(200)
    await retried.arrayBuffer()
  })

  it("frees the account when the client disconnects mid-export", async () => {
    const first = await requestExport(cookies[1]!)
    expect(first.status).toBe(200)
    await first.body!.cancel()
    const next = await requestExport(cookies[1]!)
    expect(next.status).toBe(200)
    expect(next.headers.get("content-type")).toBe("application/zip")
    await next.arrayBuffer()
  })

  it("lets an honest person export twice in a row", async () => {
    const first = await requestExport(cookies[2]!)
    expect(first.status).toBe(200)
    const firstBytes = Buffer.from(await first.arrayBuffer())
    expect(firstBytes.subarray(0, 2).toString()).toBe("PK")
    const second = await requestExport(cookies[2]!)
    expect(second.status).toBe(200)
    expect(
      Buffer.from(await second.arrayBuffer())
        .subarray(0, 2)
        .toString()
    ).toBe("PK")
  })

  it("keys the export on the signed-in account, not a userId in the query", async () => {
    const first = await app.request("/api/account/export?userId=someone-else", {
      headers: authHeaders(cookies[3]!),
    })
    expect(first.status).toBe(200)
    const second = await app.request("/api/account/export?userId=ada", {
      headers: authHeaders(cookies[3]!),
    })
    expect(second.status).toBe(429)
    expect(second.headers.get("x-limit")).toBe("export.running")
    await first.arrayBuffer()
    await second.arrayBuffer().catch(() => undefined)
  })
})
