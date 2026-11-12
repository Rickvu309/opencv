import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authLimitKey, countInWindow } from "./auth-email-limit.js"
import { codeLine, createAuthedApp, postJson } from "./auth.fixtures.js"
import type { AppDatabase } from "./db/context.js"
import { authLimitCounters } from "./db/schema.js"
import { createMigratedTestDb, testAuthUrl } from "./test/harness.js"

const SEND = "/api/auth/email-otp/send-verification-otp"
const SIGN_IN = "/api/auth/sign-in/email-otp"
const START = Date.UTC(2026, 10, 12, 9, 0, 0)

let lines: string[] = []
let address = 0

function nextAddress() {
  address += 1
  return `198.51.${Math.floor(address / 250)}.${(address % 250) + 1}`
}

function send(
  app: ReturnType<typeof createAuthedApp>,
  email: string,
  ip = nextAddress()
) {
  return postJson(app, SEND, { email, type: "sign-in" }, { "x-real-ip": ip })
}

function lastCode(email: string) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = codeLine.exec(lines[i] ?? "")
    if (match && match[1] === email) return match[3] as string
  }
  throw new Error(`no code for ${email}`)
}

function wrong(code: string, n: number) {
  return String((Number(code) + 1 + n) % 1_000_000).padStart(6, "0")
}

async function statuses(responses: (Response | Promise<Response>)[]) {
  return (await Promise.all(responses)).map((res) => res.status)
}

async function withApp(
  run: (
    app: ReturnType<typeof createAuthedApp>,
    db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  ) => Promise<void>,
  options?: { authCodeSendWarningPerHour?: number; rateLimitEnabled?: boolean }
) {
  const { client, db } = await createMigratedTestDb()
  try {
    const app = createAuthedApp(db, testAuthUrl, {
      rateLimitEnabled: options?.rateLimitEnabled ?? true,
      logAuthMail: true,
      authCodeSendWarningPerHour: options?.authCodeSendWarningPerHour,
    })
    await run(app, db)
  } finally {
    await client.close()
  }
}

beforeEach(() => {
  lines = []
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(START)
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "))
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("sign-in code sends are limited per email address", () => {
  it("refuses the sixth send in fifteen minutes even with a new address each time", async () => {
    await withApp(async (app) => {
      const seen: number[] = []
      for (let i = 0; i < 6; i += 1)
        seen.push((await send(app, "rotated@verify.local")).status)
      expect(seen).toEqual([200, 200, 200, 200, 200, 429])
    })
  })

  it("refuses the sixth send from one address spread over six minutes", async () => {
    await withApp(async (app) => {
      const seen: number[] = []
      for (let i = 0; i < 6; i += 1) {
        seen.push(
          (await send(app, "one-address@verify.local", "203.0.113.9")).status
        )
        vi.setSystemTime(START + (i + 1) * 61_000)
      }
      expect(seen).toEqual([200, 200, 200, 200, 200, 429])
    })
  })

  it("answers like the library limit, with Retry-After readable by the web origin", async () => {
    await withApp(async (app) => {
      for (let i = 0; i < 5; i += 1) await send(app, "shape@verify.local")
      const refused = await send(app, "shape@verify.local")
      expect(refused.status).toBe(429)
      expect(await refused.json()).toEqual({
        message: "Too many requests. Please try again later.",
      })
      expect(refused.headers.get("retry-after")).toBe("900")
      expect(refused.headers.get("x-retry-after")).toBe("900")
      expect(refused.headers.get("access-control-allow-origin")).toBeTruthy()
      expect(
        refused.headers.get("access-control-expose-headers")?.split(",")
      ).toContain("Retry-After")
    })
  })

  it("keeps a separate count for each email", async () => {
    await withApp(async (app) => {
      for (let i = 0; i < 5; i += 1) await send(app, "first@verify.local")
      expect((await send(app, "first@verify.local")).status).toBe(429)
      expect((await send(app, "second@verify.local")).status).toBe(200)
    })
  })

  it("counts case and space variants of one email together and keeps plus tags apart", async () => {
    await withApp(async (app) => {
      const variants = [
        "Mixed@Verify.Local",
        "mixed@verify.local",
        "MIXED@VERIFY.LOCAL",
        "mixed@Verify.local",
        "mIxEd@verify.LOCAL",
      ]
      for (const email of variants) await send(app, email)
      expect((await send(app, " mixed@verify.local ")).status).toBe(429)
      expect((await send(app, "mixed+work@verify.local")).status).toBe(200)
    })
  })

  it("allows a send again once the fifteen minutes pass", async () => {
    await withApp(async (app) => {
      for (let i = 0; i < 5; i += 1) await send(app, "window@verify.local")
      expect((await send(app, "window@verify.local")).status).toBe(429)
      vi.setSystemTime(START + 15 * 60_000)
      expect((await send(app, "window@verify.local")).status).toBe(200)
    })
  })

  it("caps one email at ten sends an hour and tells the rest of the hour", async () => {
    await withApp(async (app) => {
      const seen: { status: number; retry: string | null }[] = []
      for (let quarter = 0; quarter < 3; quarter += 1) {
        vi.setSystemTime(START + quarter * 15 * 60_000)
        for (let i = 0; i < 5; i += 1) {
          const res = await send(app, "hourly@verify.local")
          seen.push({
            status: res.status,
            retry: res.headers.get("retry-after"),
          })
        }
      }
      expect(seen.slice(0, 10).every((row) => row.status === 200)).toBe(true)
      expect(seen.slice(10)).toEqual(
        Array.from({ length: 5 }, () => ({ status: 429, retry: "1800" }))
      )
      vi.setSystemTime(START + 60 * 60_000)
      expect((await send(app, "hourly@verify.local")).status).toBe(200)
    })
  })

  it("never refuses a send for the overall count and warns without addresses past the warning level", async () => {
    const warnings: string[] = []
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    })
    await withApp(
      async (app) => {
        const seen: number[] = []
        for (let i = 0; i < 7; i += 1)
          seen.push((await send(app, `overall-${i}@verify.local`)).status)
        expect(seen).toEqual([200, 200, 200, 200, 200, 200, 200])
        expect(warnings).toEqual([
          "[auth] 4 sign-in codes sent in the hour starting 2026-11-12T09:00:00.000Z, above the warning level of 3",
          "[auth] 7 sign-in codes sent in the hour starting 2026-11-12T09:00:00.000Z, above the warning level of 3",
        ])
      },
      { authCodeSendWarningPerHour: 3 }
    )
  })

  it("counts two sends at the same instant as two", async () => {
    await withApp(async (app) => {
      for (let i = 0; i < 4; i += 1) await send(app, "race@verify.local")
      const pair = await statuses([
        send(app, "race@verify.local"),
        send(app, "race@verify.local"),
      ])
      expect(pair.sort()).toEqual([200, 429])
    })
  })

  it("increments one counter atomically under concurrent calls", async () => {
    await withApp(async (_app, db) => {
      const key = authLimitKey("secret", "race", "atomic@verify.local")
      const counts = await Promise.all(
        Array.from({ length: 10 }, () =>
          countInWindow(db as unknown as AppDatabase, key, 60_000, START)
        )
      )
      expect(counts.map((row) => row.count).sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ])
    })
  })

  it("answers a known and an unknown email the same way", async () => {
    await withApp(async (app) => {
      await send(app, "known@verify.local")
      const signedIn = await postJson(
        app,
        SIGN_IN,
        { email: "known@verify.local", otp: lastCode("known@verify.local") },
        { "x-real-ip": nextAddress() }
      )
      expect(signedIn.status).toBe(200)
      const answers = async (email: string) => {
        const seen: { status: number; body: string; retry: string | null }[] =
          []
        for (let i = 0; i < 6; i += 1) {
          const res = await send(app, email)
          seen.push({
            status: res.status,
            body: (await res.text()).replace(/"emailId":"[^"]*"/, ""),
            retry: res.headers.get("retry-after"),
          })
        }
        return seen.slice(-2)
      }
      vi.setSystemTime(START + 15 * 60_000)
      const known = await answers("known@verify.local")
      vi.setSystemTime(START + 30 * 60_000)
      const unknown = await answers("nobody@verify.local")
      expect(known).toEqual(unknown)
    })
  })

  it("keeps counts when a new app starts on the same database", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const first = createAuthedApp(db, testAuthUrl, {
        rateLimitEnabled: true,
        logAuthMail: true,
      })
      for (let i = 0; i < 5; i += 1) await send(first, "restart@verify.local")
      const second = createAuthedApp(db, testAuthUrl, {
        rateLimitEnabled: true,
        logAuthMail: true,
      })
      expect((await send(second, "restart@verify.local")).status).toBe(429)
    } finally {
      await client.close()
    }
  })

  it("stores a keyed hash, never the address, and removes expired rows", async () => {
    await withApp(async (app, db) => {
      await send(app, "stored@verify.local")
      const rows = await db.select().from(authLimitCounters)
      expect(rows.length).toBeGreaterThan(0)
      expect(JSON.stringify(rows)).not.toContain("stored@verify.local")
      vi.setSystemTime(START + 2 * 60 * 60_000)
      await send(app, "later@verify.local")
      const left = await db.select().from(authLimitCounters)
      expect(
        left.every((row) => row.expiresAt.getTime() > START + 2 * 60 * 60_000)
      ).toBe(true)
    })
  })
})

describe("the limit cannot be used to keep a person from signing in", () => {
  it("lets a person get a code after thirty sends to made-up addresses", async () => {
    await withApp(async (app) => {
      const junk: number[] = []
      for (let i = 0; i < 30; i += 1)
        junk.push((await send(app, `made-up-${i}@verify.local`)).status)
      expect(junk.every((status) => status === 200)).toBe(true)
      expect((await send(app, "victim-a@verify.local")).status).toBe(200)
    })
  })

  it("lets a person sign in with a valid code after ten wrong checks by someone else", async () => {
    await withApp(async (app) => {
      const email = "victim-b@verify.local"
      const guesses: number[] = []
      for (let i = 0; i < 10; i += 1) {
        const res = await postJson(
          app,
          SIGN_IN,
          { email, otp: "000000" },
          { "x-real-ip": nextAddress() }
        )
        guesses.push(res.status)
      }
      expect(guesses.every((status) => status === 400)).toBe(true)
      await send(app, email)
      const right = await postJson(
        app,
        SIGN_IN,
        { email, otp: lastCode(email) },
        { "x-real-ip": nextAddress() }
      )
      expect(right.status).toBe(200)
    })
  })

  it("gives a person a code at noon after twenty requests from 00:01 UTC", async () => {
    await withApp(async (app) => {
      const email = "victim-c@verify.local"
      const midnight = Date.UTC(2026, 10, 13, 0, 1, 0)
      const attack: number[] = []
      for (let quarter = 0; quarter < 4; quarter += 1) {
        vi.setSystemTime(midnight + quarter * 15 * 60_000)
        for (let i = 0; i < 5; i += 1)
          attack.push((await send(app, email)).status)
      }
      expect(attack).toHaveLength(20)
      vi.setSystemTime(Date.UTC(2026, 10, 13, 1, 0, 0))
      expect((await send(app, email)).status).toBe(200)
      vi.setSystemTime(Date.UTC(2026, 10, 13, 12, 0, 0))
      expect((await send(app, email)).status).toBe(200)
    })
  })

  it("clears the send counts for an email after a sign-in with its code", async () => {
    await withApp(async (app) => {
      const email = "cleared@verify.local"
      for (let i = 0; i < 5; i += 1) {
        vi.setSystemTime(START + i * 1000)
        await send(app, email)
      }
      const signedIn = await postJson(
        app,
        SIGN_IN,
        { email, otp: lastCode(email) },
        { "x-real-ip": nextAddress() }
      )
      expect(signedIn.status).toBe(200)
      expect((await send(app, email)).status).toBe(200)
    })
  })

  it("keeps the send counts after a wrong code", async () => {
    await withApp(async (app) => {
      const email = "kept@verify.local"
      for (let i = 0; i < 5; i += 1) await send(app, email)
      const failed = await postJson(
        app,
        SIGN_IN,
        { email, otp: wrong(lastCode(email), 0) },
        { "x-real-ip": nextAddress() }
      )
      expect(failed.status).toBe(400)
      expect((await send(app, email)).status).toBe(429)
    })
  })
})

describe("each sign-in code allows three guesses", () => {
  it("locks a code after three wrong guesses from rotating addresses", async () => {
    await withApp(
      async (app) => {
        const email = "three@verify.local"
        await send(app, email)
        const code = lastCode(email)
        const seen: string[] = []
        for (let i = 0; i < 4; i += 1) {
          const res = await postJson(
            app,
            SIGN_IN,
            { email, otp: wrong(code, i) },
            { "x-real-ip": nextAddress() }
          )
          seen.push(
            `${res.status}:${((await res.json()) as { code?: string }).code}`
          )
        }
        expect(seen).toEqual([
          "400:INVALID_OTP",
          "400:INVALID_OTP",
          "400:INVALID_OTP",
          "403:TOO_MANY_ATTEMPTS",
        ])
        const right = await postJson(
          app,
          SIGN_IN,
          { email, otp: code },
          { "x-real-ip": nextAddress() }
        )
        expect(right.status).not.toBe(200)
      },
      { rateLimitEnabled: false }
    )
  })

  it("consumes a code once, even when two sign-ins race", async () => {
    await withApp(
      async (app) => {
        const email = "once@verify.local"
        await send(app, email)
        const code = lastCode(email)
        const pair = await statuses([
          postJson(app, SIGN_IN, { email, otp: code }),
          postJson(app, SIGN_IN, { email, otp: code }),
        ])
        expect(pair.filter((status) => status === 200)).toHaveLength(1)
        const again = await postJson(app, SIGN_IN, { email, otp: code })
        expect(again.status).not.toBe(200)
      },
      { rateLimitEnabled: false }
    )
  })
})
