import { serve } from "@hono/node-server"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { createApp } from "./app.js"
import type { FetchJobPosting } from "./apply/fetch-posting.js"
import { coachRuntimeFromConfig } from "./coach/bind.js"
import { withScanJobPosting } from "./coach/fake.js"
import { COACH_MODES, type CoachMode } from "@workspace/domain"

import {
  authUrlFromEnv,
  coachDailyTurnLimitForModeFromEnv,
  coachDailyTurnLimitFromEnv,
  coachModelForModeFromEnv,
  coachModelFromEnv,
  coachRuntimeModeFromEnv,
  databaseUrlFromEnv,
  dbDriverFromEnv,
  openRouterApiKeyFromEnv,
  pgliteDataDirFromEnv,
  sessionSecretFromEnv,
  webOriginsFromEnv,
} from "./config.js"
import { migrationsFolder } from "./db/paths.js"
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
  const [{ PGlite }, { drizzle: drizzlePglite }, { migrate }] =
    await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
      import("drizzle-orm/pglite/migrator"),
    ])
  const db = drizzlePglite({ client: new PGlite(dataDir), schema })
  await migrate(db, { migrationsFolder })
  return db
}

const port = Number(process.env.PORT ?? 3001)
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
const openRouterApiKey = openRouterApiKeyFromEnv(process.env)
const coachModel = coachModelFromEnv(process.env)
const coachModels = Object.fromEntries(
  COACH_MODES.map((mode) => [mode, coachModelForModeFromEnv(mode, process.env)])
) as Record<CoachMode, string>
const coachDailyTurnLimits = Object.fromEntries(
  COACH_MODES.map((mode) => [
    mode,
    coachDailyTurnLimitForModeFromEnv(mode, process.env),
  ])
) as Record<CoachMode, number>
const coachRuntimeMode = coachRuntimeModeFromEnv(process.env)
const baseCoach = coachRuntimeFromConfig({
  db,
  openRouterApiKey,
  coachModel,
  titleModel: coachModels.light,
  scanModel: coachModels.free,
  runtimeMode: coachRuntimeMode,
})
const coach =
  coachRuntimeMode === "fake" && baseCoach
    ? withScanJobPosting(baseCoach, async () => JSON.stringify(fakePosting))
    : baseCoach

const app = createApp({
  webOrigins: webOriginsFromEnv(process.env),
  databaseUrl,
  sessionSecret: sessionSecretFromEnv(process.env),
  authUrl: authUrlFromEnv(process.env),
  openRouterApiKey,
  coachModel,
  coachModels,
  coachDailyTurnLimit: coachDailyTurnLimitFromEnv(process.env),
  coachDailyTurnLimits,
  db,
  coach,
  fetchJobPosting:
    coachRuntimeMode === "fake" ? fakeFetchJobPosting : undefined,
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`)
})
