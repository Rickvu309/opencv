import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { createAuth } from "./auth.js"
import {
  authUrlFromEnv,
  databaseUrlFromEnv,
  sessionSecretFromEnv,
  webOriginsFromEnv,
} from "./config.js"
import { user as userTable } from "./db/schema.js"
import * as schema from "./db/schema.js"
import { seedStarterWorkspace } from "./starter/workspace.js"

const databaseUrl = databaseUrlFromEnv(process.env)
const seedEmail = process.env.SEED_EMAIL?.trim().toLowerCase()

if (!databaseUrl) {
  console.error("DATABASE_URL is required to seed a workspace")
  process.exit(1)
}

if (!seedEmail) {
  console.error("SEED_EMAIL is required (the account to seed)")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle(pool, { schema })

try {
  const [existing] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, seedEmail))
    .limit(1)

  if (existing) {
    const result = await seedStarterWorkspace(db, existing.id)
    console.log(
      result.created
        ? `seeded starter workspace for ${seedEmail}`
        : `skipped ${seedEmail}: account already has Paper, Apply, or Threads`
    )
  } else {
    const sessionSecret = sessionSecretFromEnv(process.env)
    const password = process.env.SEED_PASSWORD?.trim()
    const name = process.env.SEED_NAME?.trim() || "Dev"

    if (!sessionSecret || !password) {
      console.error(
        "Account not found. Set SEED_PASSWORD and SESSION_SECRET to create it, then seed."
      )
      process.exit(1)
    }

    const auth = createAuth({
      db,
      sessionSecret,
      authUrl: authUrlFromEnv(process.env),
      webOrigins: webOriginsFromEnv(process.env),
      rateLimitEnabled: false,
    })

    const signedUp = await auth.api.signUpEmail({
      body: { name, email: seedEmail, password },
    })

    if (!signedUp.user) {
      console.error("sign-up did not return a user")
      process.exit(1)
    }

    // The signup hook seeds new accounts. Re-run in case the hook was skipped.
    const result = await seedStarterWorkspace(db, signedUp.user.id)
    console.log(
      result.created
        ? `created ${seedEmail} and seeded starter workspace`
        : `created ${seedEmail}; starter workspace already present`
    )
  }
} catch (error) {
  console.error(error)
  process.exit(1)
} finally {
  await pool.end()
}
