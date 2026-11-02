import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMigratedTestDb, testAuthUrl } from "./test/harness.js"

const SEND_PATH = "/api/auth/email-otp/send-verification-otp"

function railwayEdge(client: string, edgeHop: string) {
  return { "x-real-ip": client, "x-forwarded-for": edgeHop }
}

async function productionApp() {
  vi.stubEnv("NODE_ENV", "production")
  vi.resetModules()
  const fixtures = await import("./auth.fixtures.js")
  const { client, db } = await createMigratedTestDb()
  const app = fixtures.createAuthedApp(db, testAuthUrl, {
    rateLimitEnabled: true,
    logAuthMail: true,
  })
  const send = (email: string, headers: Record<string, string> = {}) =>
    fixtures.postJson(app, SEND_PATH, { email, type: "sign-in" }, headers)
  return { client, send }
}

async function statuses(
  send: (
    email: string,
    headers?: Record<string, string>
  ) => Response | Promise<Response>,
  email: string,
  headers: Record<string, string> | Array<Record<string, string>>,
  count: number
) {
  const result: number[] = []
  for (let i = 0; i < count; i += 1) {
    const sent = Array.isArray(headers) ? headers[i % headers.length] : headers
    result.push((await send(email, sent)).status)
  }
  return result
}

describe("sign-in code limit in production", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("gives each client its own bucket from the header Railway sets", async () => {
    const { client, send } = await productionApp()
    try {
      const first = railwayEdge("203.0.113.5", "172.68.0.1")
      const second = railwayEdge("198.51.100.7", "172.68.0.1")
      expect(await statuses(send, "a1@verify.local", first, 4)).toEqual([
        200, 200, 200, 429,
      ])
      expect(await statuses(send, "b1@verify.local", second, 3)).toEqual([
        200, 200, 200,
      ])
    } finally {
      await client.close()
    }
  })

  it("does not let forwarded entries change a client's bucket", async () => {
    const { client, send } = await productionApp()
    try {
      const rotating = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"].map(
        (entry) => railwayEdge("203.0.113.9", `${entry}, 172.68.0.1`)
      )
      expect(await statuses(send, "a2@verify.local", rotating, 4)).toEqual([
        200, 200, 200, 429,
      ])
    } finally {
      await client.close()
    }
  })

  it("shares one bucket when no real address arrives", async () => {
    const { client, send } = await productionApp()
    try {
      const forged = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"].map(
        (entry) => ({ "x-forwarded-for": `${entry}, 172.68.0.1` })
      )
      expect(await statuses(send, "a3@verify.local", forged, 4)).toEqual([
        200, 200, 200, 429,
      ])
      expect(await statuses(send, "b3@verify.local", {}, 1)).toEqual([429])
    } finally {
      await client.close()
    }
  })
})
