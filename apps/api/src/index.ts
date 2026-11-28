import { serve } from "@hono/node-server"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { registry } from "./registry/registry.js"
import { createApp } from "./app.js"
import type { FetchJobPosting } from "./job/index.js"
import {
  createDemoCoachRuntime,
  startEmbeddedCoachWorker,
  withScanJobPosting,
} from "./coach/index.js"
import { sweepUnattachedPhotos } from "./paper/index.js"
import {
  apiPortFromEnv,
  authUrlFromEnv,
  coachModelEnvFromEnv,
  coachRuntimeModeFromEnv,
  databaseUrlFromEnv,
  dbDriverFromEnv,
  authEmailFromFromEnv,
  commitShaFromEnv,
  gmailEnabledFromEnv,
  sendCodeLimitEnabledFromEnv,
  authCodeSendWarningPerHourFromEnv,
  logAuthMailFromEnv,
  googleClientIdFromEnv,
  googleClientSecretFromEnv,
  googleEnabledFromEnv,
  pgliteDataDirFromEnv,
  resendApiKeyFromEnv,
  sessionSecretFromEnv,
  webOriginsFromEnv,
} from "./platform/config.js"
import { bindDatabase, type AppDatabase } from "./db/context.js"
import { runMigrations } from "./db/migrate.js"
import * as schema from "./db/schema.js"

const fakePosting = {
  title: "Associate Product Manager Intern",
  company: "Northwind Labs",
  note: "Hanoi",
}

const fakeFetchJobPosting: FetchJobPosting = async () => ({
  ok: true,
  text: `${fakePosting.company} is hiring an ${fakePosting.title} in ${fakePosting.note}. Own one discovery note a month and ship it with the team.`,
})

async function createPgliteDb(dataDir: string) {
  if (process.env.NODE_ENV === "production") {
    console.error("DB_DRIVER=pglite is local-only and refused in production")
    process.exit(1)
  }
  const [{ PGlite }, { drizzle: drizzlePglite }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
  ])
  const db = drizzlePglite({ client: new PGlite(dataDir), schema })
  await runMigrations(db as unknown as AppDatabase)
  return db
}

const port = apiPortFromEnv(process.env)
const databaseUrl = databaseUrlFromEnv(process.env)
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : undefined
const db =
  dbDriverFromEnv(process.env) === "pglite"
    ? await createPgliteDb(pgliteDataDirFromEnv(process.env))
    : pool
      ? drizzle(pool, { schema })
      : undefined

if (db) bindDatabase(db as AppDatabase)

const UNATTACHED_PHOTO_SWEEP_INTERVAL_MS = 60 * 60 * 1000

if (db && !process.env.VITEST) {
  const sweepUnattached = () =>
    sweepUnattachedPhotos().catch((error) =>
      console.error("[paper] unattached photo sweep failed", error)
    )
  void sweepUnattached()
  const sweepTimer = setInterval(
    sweepUnattached,
    UNATTACHED_PHOTO_SWEEP_INTERVAL_MS
  )
  sweepTimer.unref()
}

const coachRuntimeMode = coachRuntimeModeFromEnv(process.env)
const coachEnv = coachModelEnvFromEnv(process.env)
const coach =
  coachRuntimeMode === "fake"
    ? withScanJobPosting(createDemoCoachRuntime(), async () =>
        JSON.stringify(fakePosting)
      )
    : undefined

const sendCodeLimitEnabled = sendCodeLimitEnabledFromEnv(process.env)
if (!sendCodeLimitEnabled)
  console.log("sign-in code send limit is off for a local verify run")

const app = createApp({
  webOrigins: webOriginsFromEnv(process.env),
  databaseUrl,
  sessionSecret: sessionSecretFromEnv(process.env),
  authUrl: authUrlFromEnv(process.env),
  db,
  coach,
  coachEnv,
  gmailEnabled: gmailEnabledFromEnv(process.env),
  googleEnabled: googleEnabledFromEnv(process.env),
  googleClientId: googleClientIdFromEnv(process.env),
  googleClientSecret: googleClientSecretFromEnv(process.env),
  resendApiKey: resendApiKeyFromEnv(process.env),
  authEmailFrom: authEmailFromFromEnv(process.env),
  logAuthMail: logAuthMailFromEnv(process.env),
  sendCodeLimitEnabled,
  authCodeSendWarningPerHour: authCodeSendWarningPerHourFromEnv(process.env),
  commitSha: commitShaFromEnv(process.env),
  interpretPostings:
    coachRuntimeMode !== "fake" && Boolean(coachEnv.ANTHROPIC_API_KEY),
  fetchJobPosting:
    coachRuntimeMode === "fake" ? fakeFetchJobPosting : undefined,
})

const stopCoachWorker = db ? startEmbeddedCoachWorker(registry) : async () => {}
process.once("SIGTERM", () => {
  void stopCoachWorker().finally(() => process.exit(0))
})
process.once("SIGINT", () => {
  void stopCoachWorker().finally(() => process.exit(0))
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`)
})
