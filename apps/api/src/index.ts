import { serve } from "@hono/node-server"

import { createApp } from "./app.js"
import { databaseUrlFromEnv, webOriginsFromEnv } from "./config.js"

const port = Number(process.env.PORT ?? 3001)
const app = createApp({
  webOrigins: webOriginsFromEnv(process.env),
  databaseUrl: databaseUrlFromEnv(process.env),
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`)
})
