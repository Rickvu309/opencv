import { serve } from "@hono/node-server"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { createApp } from "./app.js"
import { coachRuntimeFromConfig } from "./coach/bind.js"
import {
  COACH_MODES,
  type CoachMode,
} from "@workspace/domain"

import {
  authUrlFromEnv,
  coachDailyTurnLimitForModeFromEnv,
  coachDailyTurnLimitFromEnv,
  coachModelForModeFromEnv,
  coachModelFromEnv,
  coachRuntimeModeFromEnv,
  databaseUrlFromEnv,
  openRouterApiKeyFromEnv,
  sessionSecretFromEnv,
  webOriginsFromEnv,
} from "./config.js"
import * as schema from "./db/schema.js"

const port = Number(process.env.PORT ?? 3001)
const databaseUrl = databaseUrlFromEnv(process.env)
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : undefined
const db = pool ? drizzle(pool, { schema }) : undefined
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
const coach = coachRuntimeFromConfig({
  db,
  openRouterApiKey,
  coachModel,
  titleModel: coachModels.light,
  runtimeMode: coachRuntimeModeFromEnv(process.env),
})

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
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`)
})
