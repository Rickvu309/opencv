import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createAuth } from "./auth.js"
import {
  BLOCKED_AUTH_PATHS,
  SERVED_OTP_PATHS,
  isBlockedAuthPath,
} from "./auth-routes.js"
import { createAuthedApp, postJson } from "./auth.fixtures.js"
import {
  createMigratedTestDb,
  testAuthUrl,
  testWebOrigin,
} from "./test/harness.js"

let client: PGlite
let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
let app: ReturnType<typeof createAuthedApp>

beforeAll(async () => {
  ;({ client, db } = await createMigratedTestDb())
  app = createAuthedApp(db as never, testAuthUrl)
})

afterAll(async () => {
  await client.close()
})

function registeredOtpPaths() {
  const auth = createAuth({
    db: db as never,
    sessionSecret: "test-session-secret-that-is-at-least-32ch",
    authUrl: testAuthUrl,
    webOrigins: [testWebOrigin],
  })
  return Object.values(auth.api)
    .map((endpoint) => (endpoint as { path?: string }).path)
    .filter((path): path is string => typeof path === "string")
    .filter((path) => path.includes("email-otp"))
    .sort()
}

describe("the sign-in code routes the api serves", () => {
  it("every code route the auth library registers is decided: served or blocked", () => {
    expect(registeredOtpPaths()).toEqual(
      [...BLOCKED_AUTH_PATHS, ...SERVED_OTP_PATHS].sort()
    )
  })

  it("a blocked route answers 404 however the path is spelled", async () => {
    const spellings = BLOCKED_AUTH_PATHS.flatMap((path) => [
      `/api/auth${path}`,
      `/api/auth${path}/`,
      `/api/auth/${path}`,
      `/api/auth${path.toUpperCase()}`,
      `/api/auth${path.replace("check", "%63heck")}`,
      `/api/auth${path}?x=1`,
    ])
    const answered: string[] = []
    for (const spelling of spellings) {
      const res = await postJson(app, spelling, {
        email: "ada@example.com",
        type: "sign-in",
        otp: "000000",
      })
      if (res.status !== 404) answered.push(`${spelling} -> ${res.status}`)
    }
    expect(answered, "spellings the auth library answered").toEqual([])
  })

  it("a served route is not blocked", async () => {
    for (const path of SERVED_OTP_PATHS) {
      expect(isBlockedAuthPath(`/api/auth${path}`), path).toBe(false)
      const res = await postJson(app, `/api/auth${path}`, {})
      expect(res.status, path).not.toBe(404)
    }
  })
})
