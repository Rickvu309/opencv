import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AUTH_EMAIL_CAPS,
  authLimitKey,
  countInWindow,
} from "./auth-email-limit.js"
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
  options?: { authCodeSendsPerHour?: number; rateLimitEnabled?: boolean }
) {
  const { client, db } = await createMigratedTestDb()
  try {
    const app = createAuthedApp(db, testAuthUrl, {
      rateLimitEnabled: options?.rateLimitEnabled ?? true,
      logAuthMail: true,
      authCodeSendsPerHour: options?.authCodeSendsPerHour,
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

  it("answers like the library limit, with Retry-After and the web origin allowed", async () => {
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

  it("caps one email at twenty sends a day across windows", async () => {
    await withApp(async (app) => {
      const seen: number[] = []
      for (let quarter = 0; quarter < 5; quarter += 1) {
        vi.setSystemTime(START + quarter * 15 * 60_000)
        for (let i = 0; i < 5; i += 1)
          seen.push((await send(app, "daily@verify.local")).status)
      }
      expect(seen.filter((status) => status === 200)).toHaveLength(20)
      expect(seen.slice(20)).toEqual([429, 429, 429, 429, 429])
    })
  })

  it("caps all sends in an hour across emails", async () => {
    await withApp(
      async (app) => {
        const seen: number[] = []
        for (let i = 0; i < 4; i += 1)
          seen.push((await send(app, `overall-${i}@verify.local`)).status)
        expect(seen).toEqual([200, 200, 200, 429])
        vi.setSystemTime(START + 60 * 60_000)
        expect((await send(app, "overall-9@verify.local")).status).toBe(200)
      },
      { authCodeSendsPerHour: 3 }
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
      vi.setSystemTime(START + 2 * 24 * 60 * 60_000)
      await send(app, "later@verify.local")
      const left = await db.select().from(authLimitCounters)
      expect(
        left.every((row) => row.expiresAt.getTime() > START + 24 * 60 * 60_000)
      ).toBe(true)
    })
  })
})

describe("failed code checks are capped per email address", () => {
  it("blocks checks for the day after ten failures, even with the right code", async () => {
    await withApp(async (app) => {
      const email = "guessed@verify.local"
      const failed: number[] = []
      for (let code = 0; code < 4; code += 1) {
        await send(app, email)
        const sent = lastCode(email)
        for (let guess = 0; guess < 3 && failed.length < 10; guess += 1) {
          const res = await postJson(
            app,
            SIGN_IN,
            { email, otp: wrong(sent, guess) },
            { "x-real-ip": nextAddress() }
          )
          failed.push(res.status)
        }
      }
      expect(failed).toHaveLength(10)
      expect(failed.every((status) => status === 400 || status === 403)).toBe(
        true
      )
      await send(app, email)
      const right = await postJson(
        app,
        SIGN_IN,
        { email, otp: lastCode(email) },
        { "x-real-ip": nextAddress() }
      )
      expect(right.status).toBe(429)
      expect(Number(right.headers.get("retry-after"))).toBeGreaterThan(0)
      vi.setSystemTime(START + 24 * 60 * 60_000)
      await send(app, email)
      const nextDay = await postJson(
        app,
        SIGN_IN,
        { email, otp: lastCode(email) },
        { "x-real-ip": nextAddress() }
      )
      expect(nextDay.status).toBe(200)
    })
  })

  it("does not count a successful check against the cap", async () => {
    await withApp(async (app) => {
      const email = "careful@verify.local"
      for (
        let round = 0;
        round < AUTH_EMAIL_CAPS.failedChecksPerEmailPerDay + 2;
        round += 1
      ) {
        vi.setSystemTime(START + round * 15 * 60_000)
        await send(app, email)
        const res = await postJson(
          app,
          SIGN_IN,
          { email, otp: lastCode(email) },
          { "x-real-ip": nextAddress() }
        )
        expect(res.status).toBe(200)
      }
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
