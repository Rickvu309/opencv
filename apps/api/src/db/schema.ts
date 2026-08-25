import { pgSchema } from "drizzle-orm/pg-core"

/** App tables live in this schema (ADR-0006). */
export const openpathApp = pgSchema("openpath_app")
