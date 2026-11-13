import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"

import { createApp } from "../app.js"
import type { AppDatabase } from "../db/context.js"
import { runMigrations } from "../db/migrate.js"
import * as schema from "../db/schema.js"

export type SeedStack = {
  sessionSecret: string
  authUrl: string
  webOrigin: string
}

export type SeededAccount = { email: string; setCookie: string[] }

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"]
const CODE_LINE = /^\[auth\] email code for (\S+) type sign-in: ([0-9]{6})$/

export const seededEmail = (seq: number) =>
  `ui-seed-${String(seq).padStart(5, "0")}@example.com`

export function notLocalProblem(
  stack: SeedStack,
  nodeEnv: string | undefined
): string | null {
  if (nodeEnv === "production")
    return "seedSessions refuses to run with NODE_ENV=production"
  if (stack.sessionSecret.length < 32)
    return "seedSessions needs the local stack's session secret"
  for (const [name, value] of [
    ["auth url", stack.authUrl],
    ["web origin", stack.webOrigin],
  ] as const) {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      return `seedSessions needs a local ${name}, got an unreadable one`
    }
    if (url.protocol !== "http:" || !LOCAL_HOSTS.includes(url.hostname))
      return `seedSessions runs only against a local http ${name}, got ${url.origin}`
  }
  return null
}

async function signInLogged(
  app: ReturnType<typeof createApp>,
  stack: SeedStack,
  email: string
): Promise<SeededAccount> {
  const headers = {
    Origin: stack.webOrigin,
    "Content-Type": "application/json",
  }
  const lines: string[] = []
  const log = console.log
  console.log = (...parts: unknown[]) => {
    lines.push(parts.map(String).join(" "))
  }
  let sent: Response
  try {
    sent = await app.request("/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, type: "sign-in" }),
    })
  } finally {
    console.log = log
  }
  if (sent.status !== 200)
    throw new Error(`sign-in code for ${email} failed with ${sent.status}`)
  const otp = lines
    .map((line) => line.match(CODE_LINE))
    .find((match) => match?.[1] === email)?.[2]
  if (!otp) throw new Error(`no sign-in code was logged for ${email}`)
  const signed = await app.request("/api/auth/sign-in/email-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, otp }),
  })
  if (signed.status !== 200)
    throw new Error(`sign-in for ${email} failed with ${signed.status}`)
  return { email, setCookie: signed.headers.getSetCookie() }
}

export async function seedSessions(
  dataDir: string,
  count: number,
  stack: SeedStack,
  nodeEnv: string | undefined = process.env.NODE_ENV
): Promise<SeededAccount[]> {
  const refused = notLocalProblem(stack, nodeEnv)
  if (refused) throw new Error(refused)
  if (!Number.isInteger(count) || count < 1)
    throw new Error(
      `seedSessions needs a whole count of at least 1, got ${count}`
    )
  if (existsSync(dataDir) && readdirSync(dataDir).length > 0)
    throw new Error(
      `seedSessions writes only into a new database, and ${dataDir} already holds one`
    )
  mkdirSync(dataDir, { recursive: true })
  const client = new PGlite(dataDir)
  try {
    const db = drizzle({ client, schema })
    await runMigrations(db as unknown as AppDatabase)
    const app = createApp({
      webOrigins: [stack.webOrigin],
      sessionSecret: stack.sessionSecret,
      authUrl: stack.authUrl,
      db,
      rateLimitEnabled: false,
      coachDurable: false,
      logAuthMail: true,
    })
    const accounts: SeededAccount[] = []
    for (let seq = 1; seq <= count; seq += 1)
      accounts.push(await signInLogged(app, stack, seededEmail(seq)))
    return accounts
  } finally {
    await client.close()
  }
}

export function writeSeeded(outDir: string, accounts: SeededAccount[]) {
  mkdirSync(outDir, { recursive: true, mode: 0o700 })
  accounts.forEach((account, index) =>
    writeFileSync(
      join(outDir, `${String(index + 1).padStart(5, "0")}.json`),
      JSON.stringify(account),
      { mode: 0o600 }
    )
  )
}

async function main([dataDir, count, outDir]: string[]) {
  if (!dataDir || !count || !outDir)
    throw new Error("usage: seed-sessions.ts <pglite dir> <count> <out dir>")
  const started = Date.now()
  const accounts = await seedSessions(dataDir, Number(count), {
    sessionSecret: process.env.SESSION_SECRET ?? "",
    authUrl: process.env.AUTH_URL ?? "",
    webOrigin: (process.env.WEB_ORIGINS ?? "").split(",")[0] ?? "",
  })
  writeSeeded(outDir, accounts)
  process.stdout.write(
    `seeded ${accounts.length} signed-in accounts in ${Date.now() - started} ms\n`
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  await main(process.argv.slice(2)).catch((error: Error) => {
    process.stderr.write(`seed-sessions: ${error.message}\n`)
    process.exit(1)
  })
