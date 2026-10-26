import { serve } from "@hono/node-server"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { createApp } from "./app.js"
import type { FetchJobPosting } from "./apply/fetch-posting.js"
import { createDemoCoachRuntime, withScanJobPosting } from "./coach/index.js"
import {
  authUrlFromEnv,
  coachRuntimeModeFromEnv,
  databaseUrlFromEnv,
  dbDriverFromEnv,
  pgliteDataDirFromEnv,
  sessionSecretFromEnv,
  webOriginsFromEnv,
} from "./config.js"
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

const port = Number(process.env.PORT ?? 3001)
const databaseUrl = databaseUrlFromEnv(process.env)
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined
const db =
  dbDriverFromEnv(process.env) === "pglite"
    ? await createPgliteDb(pgliteDataDirFromEnv(process.env))
    : pool
      ? drizzle(pool, { schema })
      : undefined

if (db) bindDatabase(db as AppDatabase)

const coachRuntimeMode = coachRuntimeModeFromEnv(process.env)
const coach =
  coachRuntimeMode === "fake"
    ? withScanJobPosting(createDemoCoachRuntime(), async () =>
        JSON.stringify(fakePosting)
      )
    : undefined

const app = createApp({
  webOrigins: webOriginsFromEnv(process.env),
  databaseUrl,
  sessionSecret: sessionSecretFromEnv(process.env),
  authUrl: authUrlFromEnv(process.env),
  db,
  coach,
  fetchJobPosting: coachRuntimeMode === "fake" ? fakeFetchJobPosting : undefined,
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`)
})
