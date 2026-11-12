import { jsonb, text, type PgSchema } from "drizzle-orm/pg-core"

export function createSecondSchemaTables(opencvApp: PgSchema<"opencv_app">) {
  return {
    resumeDrafts: opencvApp.table("resume_drafts", {
      id: text("id").primaryKey(),
      body: jsonb("body").$type<unknown>(),
    }),
  }
}
