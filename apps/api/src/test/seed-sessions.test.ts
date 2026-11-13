import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterEach, describe, expect, it } from "vitest"

import { createApp } from "../app.js"
import * as schema from "../db/schema.js"
import { createMigratedTestDb, testSessionSecret } from "./harness.js"
import {
  PRODUCTION_ENTRY,
  SEED_MODULE,
  reachableFrom,
} from "./seed-sessions-reach.js"
import { seedSessions, type SeedStack } from "./seed-sessions.js"

const apiRoot = fileURLToPath(new URL("../..", import.meta.url))
const readApi = (file: string) => {
  try {
    return readFileSync(join(apiRoot, file), "utf8")
  } catch {
    return null
  }
}

const stack: SeedStack = {
  sessionSecret: "ocv-ui-local-session-secret-seed-test-0123456789abcdef",
  authUrl: "http://localhost:4399",
  webOrigin: "http://localhost:5399",
}

const dirs: string[] = []
const freshDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "seed-sessions-"))
  dirs.push(dir)
  return join(dir, "pglite")
}

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

const cookieOf = (setCookie: string[]) =>
  setCookie.map((line) => line.split(";")[0]).join("; ")

describe("seedSessions", () => {
  it("makes 41 accounts with their own addresses whose sessions open Paper in the app that starts on the same database afterwards", async () => {
    const dataDir = freshDir()
    const accounts = await seedSessions(dataDir, 41, stack, "development")
    expect(accounts).toHaveLength(41)
    expect(new Set(accounts.map((account) => account.email)).size).toBe(41)
    const client = new PGlite(dataDir)
    try {
      const app = createApp({
        webOrigins: [stack.webOrigin],
        sessionSecret: stack.sessionSecret,
        authUrl: stack.authUrl,
        db: drizzle({ client, schema }),
        coachDurable: false,
      })
      for (const account of accounts) {
        const headers = {
          Origin: stack.webOrigin,
          Cookie: cookieOf(account.setCookie),
        }
        const paper = await app.request("/api/paper", { headers })
        expect(paper.status).toBe(200)
        const session = await app.request("/api/auth/get-session", { headers })
        const body = (await session.json()) as { user: { email: string } }
        expect(body.user.email).toBe(account.email)
      }
      const stranger = await app.request("/api/paper", {
        headers: { Origin: stack.webOrigin },
      })
      expect(stranger.status).toBe(401)
    } finally {
      await client.close()
    }
  }, 120_000)

  it("refuses to seed a second time into the same database", async () => {
    const dataDir = freshDir()
    await seedSessions(dataDir, 1, stack, "development")
    await expect(
      seedSessions(dataDir, 1, stack, "development")
    ).rejects.toThrow(
      /writes only into a new database, and .* already holds one/
    )
  }, 60_000)

  it.each([
    [{ ...stack }, "production", /NODE_ENV=production/],
    [
      { ...stack, authUrl: "https://api.opencv.me" },
      "development",
      /local http auth url, got https:\/\/api\.opencv\.me/,
    ],
    [
      { ...stack, authUrl: "http://api.opencv.me" },
      "development",
      /local http auth url/,
    ],
    [
      { ...stack, webOrigin: "https://opencv.me" },
      "development",
      /local http web origin/,
    ],
    [{ ...stack, sessionSecret: "" }, "development", /session secret/],
    [{ ...stack, authUrl: "not a url" }, "development", /unreadable/],
  ] as const)(
    "fails closed outside a local stack and writes nothing (%#)",
    async (bad, nodeEnv, refusal) => {
      const dataDir = freshDir()
      await expect(seedSessions(dataDir, 1, bad, nodeEnv)).rejects.toThrow(
        refusal
      )
      expect(existsSync(dataDir)).toBe(false)
    }
  )
})

describe("the production server cannot reach the seeding module", () => {
  it("the server entry's import graph holds no test module", () => {
    const reached = reachableFrom(PRODUCTION_ENTRY, readApi)
    expect(reached.has("src/app.ts")).toBe(true)
    expect(reached.has("src/auth.ts")).toBe(true)
    expect(reached.size).toBeGreaterThan(100)
    expect(reached.has(SEED_MODULE)).toBe(false)
    expect([...reached].filter((file) => file.startsWith("src/test/"))).toEqual(
      []
    )
  })

  it("the served route table has no seeding route, and asking for one gets the same answer as any unknown route", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createApp({
        webOrigins: ["https://opencv.me"],
        sessionSecret: testSessionSecret,
        authUrl: "https://api.opencv.me",
        db,
        coachDurable: false,
        logAuthMail: false,
      })
      expect(app.routes.length).toBeGreaterThan(20)
      expect(app.routes.filter((route) => /seed/i.test(route.path))).toEqual([])
      const paths = [
        "/api/test/seed-sessions",
        "/api/seed-sessions",
        "/seed-sessions",
        "/api/auth/seed-sessions",
        "/api/v1/seed-sessions",
      ]
      for (const path of paths)
        for (const method of ["GET", "POST"]) {
          const ask = (target: string) =>
            app.request(target, {
              method,
              headers: {
                Origin: "https://opencv.me",
                "Content-Type": "application/json",
              },
              body:
                method === "POST" ? JSON.stringify({ count: 41 }) : undefined,
            })
          const seeding = await ask(path)
          const unknown = await ask(
            path.replace("seed-sessions", "no-such-route-7f3a")
          )
          expect([seeding.status, await seeding.text()]).toEqual([
            unknown.status,
            await unknown.text(),
          ])
          expect(seeding.status).toBe(404)
        }
    } finally {
      await client.close()
    }
  })
})
