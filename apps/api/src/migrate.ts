import { databaseUrlFromEnv } from "./platform/config.js"
import { applyMigrations } from "./db/migrate.js"

const databaseUrl = databaseUrlFromEnv(process.env)

if (!databaseUrl) {
  console.error("DATABASE_URL is required to apply migrations")
  process.exit(1)
}

try {
  await applyMigrations(databaseUrl)
  console.log("migrations applied")
} catch (error) {
  console.error(error)
  process.exit(1)
}
