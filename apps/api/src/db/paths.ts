import path from "node:path"
import { fileURLToPath } from "node:url"

/** Committed SQL migrations. Resolved from both `src/` and compiled `dist/`. */
export const migrationsFolder = path.join(
  fileURLToPath(new URL("../..", import.meta.url)),
  "drizzle"
)
