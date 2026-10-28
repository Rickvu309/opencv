import { afterEach, describe, expect, it, vi } from "vitest"
import { createMigratedTestDb, testAuthUrl } from "./test/harness.js"
import {
  cookieHeader,
  createAuthedApp,
  postJson,
  sendSignInCode,
  signInWithCode,
} from "./auth.fixtures.js"

describe("auth email privacy", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each(["missing configuration", "provider outage"])(
    "keeps registered and unregistered addresses indistinguishable during %s",
    async (failure) => {
      const { client, db } = await createMigratedTestDb()
      try {
        const seed = createAuthedApp(db, testAuthUrl, { logAuthMail: true })
        const registered = "registered@verify.local"
        const unknown = "unknown@verify.local"
        const issued = await sendSignInCode(seed, registered)
        expect(issued.code).toMatch(/^[0-9]{6}$/)
        const signedIn = await signInWithCode(
          seed,
          registered,
          issued.code ?? ""
        )
        expect(signedIn.status).toBe(200)
        const cookie = cookieHeader(signedIn)
        const owner = "owner@verify.local"
        const ownerCode = await sendSignInCode(seed, owner)
        const ownerSession = await signInWithCode(
          seed,
          owner,
          ownerCode.code ?? ""
        )
        expect(ownerSession.status).toBe(200)
        const ownerCookie = cookieHeader(ownerSession)

        vi.stubGlobal(
          "fetch",
          vi.fn(async () => new Response("unavailable", { status: 500 }))
        )
        vi.spyOn(console, "error").mockImplementation(() => {})
        const app = createAuthedApp(db, testAuthUrl, {
          logAuthMail: false,
          ...(failure === "provider outage"
            ? { resendApiKey: "test-key", authEmailFrom: "codes@opencv.me" }
            : {}),
        })
        const routes = [
          {
            path: "/api/auth/email-otp/send-verification-otp",
            type: "forget-password",
          },
          {
            path: "/api/auth/email-otp/send-verification-otp",
            type: "email-verification",
          },
          { path: "/api/auth/email-otp/request-password-reset" },
          { path: "/api/auth/forget-password/email-otp" },
        ]
        for (const route of routes) {
          for (const email of [registered, unknown]) {
            const res = await postJson(
              app,
              route.path,
              {
                email,
                ...(route.type ? { type: route.type } : {}),
              },
              { Cookie: cookie }
            )
            expect(res.status, `${route.path} ${email}`).toBe(200)
            await expect(res.json()).resolves.toEqual({ success: true })
          }
        }
        for (const email of [registered, unknown]) {
          const direct = await postJson(
            app,
            "/api/auth/email-otp/request-email-change",
            {
              newEmail: email,
            },
            { Cookie: ownerCookie }
          )
          expect(direct.status).toBe(200)
          await expect(direct.json()).resolves.toEqual({ success: true })
          const command = await postJson(
            app,
            "/api/commands/account.requestEmailChange",
            {
              input: { email },
            },
            { Cookie: ownerCookie }
          )
          expect(command.status).toBe(200)
          await expect(command.json()).resolves.toMatchObject({
            ok: true,
            data: { sent: true },
          })
        }
      } finally {
        await client.close()
      }
    }
  )
})
