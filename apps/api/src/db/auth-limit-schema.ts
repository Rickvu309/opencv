import {
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  type PgSchema,
} from "drizzle-orm/pg-core"

export function createAuthLimitTable(opencvApp: PgSchema<"opencv_app">) {
  const timestamptz = (name: string) =>
    timestamp(name, { withTimezone: true, mode: "date" })
  return opencvApp.table(
    "auth_limit_counters",
    {
      key: text("key").notNull(),
      windowStart: timestamptz("window_start").notNull(),
      count: integer("count").notNull(),
      expiresAt: timestamptz("expires_at").notNull(),
    },
    (table) => [
      primaryKey({ columns: [table.key, table.windowStart] }),
      index("auth_limit_counters_expires_at_idx").on(table.expiresAt),
    ]
  )
}
