import { getIP } from "better-auth/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAuth } from "./auth.js"
import { createAuthedApp, postJson } from "./auth.fixtures.js"
import {
  createMigratedTestDb,
  testAuthUrl,
  testSessionSecret,
  testWebOrigin,
} from "./test/harness.js"

const SEND_PATH = "/api/auth/email-otp/send-verification-otp"
const EDGE_HOP = "172.68.0.1"

function railwayRequest(headers: Record<string, string>) {
  return new Request("https://api.opencv.me/api/auth/email-otp/x", { headers })
}

async function resolver() {
  const { client, db } = await createMigratedTestDb()
  const auth = createAuth({
    db,
    sessionSecret: testSessionSecret,
    authUrl: testAuthUrl,
    webOrigins: [testWebOrigin],
  })
  return {
    close: () => client.close(),
    resolve: (headers: Record<string, string>) =>
      getIP(railwayRequest(headers), auth.options),
  }
}

describe("address the sign-in limit keys on", () => {
  it("is the client Railway puts in x-real-ip, not the forwarded edge hop", async () => {
    const { close, resolve } = await resolver()
    try {
      expect(
        resolve({ "x-real-ip": "203.0.113.5", "x-forwarded-for": EDGE_HOP })
      ).toBe("203.0.113.5")
    } finally {
      await close()
    }
  })

  it("ignores every forwarded entry when x-real-ip is present", async () => {
    const { close, resolve } = await resolver()
    try {
      const resolved = ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map((entry) =>
        resolve({
          "x-real-ip": "203.0.113.9",
          "x-forwarded-for": `${entry}, ${EDGE_HOP}`,
        })
      )
      expect(resolved).toEqual(["203.0.113.9", "203.0.113.9", "203.0.113.9"])
    } finally {
      await close()
    }
  })

  it("gives a forwarded address no weight when x-real-ip is missing", async () => {
    const { close, resolve } = await resolver()
    try {
      const nothing = resolve({})
      expect(resolve({ "x-forwarded-for": "198.51.100.200" })).toBe(nothing)
      expect(resolve({ "x-forwarded-for": `1.1.1.1, ${EDGE_HOP}` })).toBe(
        nothing
      )
    } finally {
      await close()
    }
  })
})

describe("sign-in code limit per client", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("keeps one client's three sends from limiting another", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createAuthedApp(db, testAuthUrl, {
        rateLimitEnabled: true,
        logAuthMail: true,
      })
      const send = async (email: string, realIp: string) =>
        (
          await postJson(
            app,
            SEND_PATH,
            { email, type: "sign-in" },
            { "x-real-ip": realIp, "x-forwarded-for": EDGE_HOP }
          )
        ).status
      const first: number[] = []
      for (let i = 0; i < 4; i += 1) {
        first.push(await send("first@verify.local", "203.0.113.41"))
      }
      expect(first).toEqual([200, 200, 200, 429])
      expect(await send("second@verify.local", "198.51.100.42")).toBe(200)
    } finally {
      await client.close()
    }
  })
})
