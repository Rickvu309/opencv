import { serve } from "@hono/node-server"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { createApp } from "./app.js"
import {
  authUrlFromEnv,
  databaseUrlFromEnv,
  sessionSecretFromEnv,
  webOriginsFromEnv,
} from "./config.js"
import * as schema from "./db/schema.js"

const port = Number(process.env.PORT ?? 3001)
const databaseUrl = databaseUrlFromEnv(process.env)
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined
const db = pool ? drizzle(pool, { schema }) : undefined

const app = createApp({
  webOrigins: webOriginsFromEnv(process.env),
  databaseUrl,
  sessionSecret: sessionSecretFromEnv(process.env),
  authUrl: authUrlFromEnv(process.env),
  db,
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`)
})
