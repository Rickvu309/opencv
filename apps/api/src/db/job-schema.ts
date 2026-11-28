import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  text,
  uuid,
  type AnyPgColumn,
  type PgSchema,
} from "drizzle-orm/pg-core"

import { timestamptz } from "./column-types.js"

export function createJobTables(
  opencvApp: PgSchema<"opencv_app">,
  refs: {
    user: { id: AnyPgColumn }
    paperDocs: { id: AnyPgColumn }
  }
) {
  const { user, paperDocs } = refs
  const jobs = opencvApp.table(
    "jobs",
    {
      id: uuid("id").primaryKey(),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      title: text("title").notNull(),
      company: text("company").notNull(),
      stage: text("stage")
        .$type<"saved" | "applied" | "interview" | "offer" | "closed">()
        .notNull()
        .default("saved"),
      position: text("position").notNull(),
      location: text("location"),
      priority: text("priority")
        .$type<"low" | "normal" | "high">()
        .notNull()
        .default("normal"),
      priorityRevision: integer("priority_revision").notNull().default(0),
      jobUrl: text("job_url"),
      sourceHost: text("source_host"),
      description: text("description"),
      posting: jsonb("posting").$type<{
        about: string
        duties: string
        requirements: string
        details: string
      } | null>(),
      interviewAt: timestamptz("interview_at"),
      deadline: date("deadline", { mode: "string" }),
      recruiterName: text("recruiter_name"),
      recruiterEmail: text("recruiter_email"),
      cvDocId: uuid("cv_doc_id").references(() => paperDocs.id, {
        onDelete: "set null",
      }),
      letterDocId: uuid("letter_doc_id").references(() => paperDocs.id, {
        onDelete: "set null",
      }),
      starred: boolean("starred").notNull().default(false),
      createdAt: timestamptz("created_at").notNull().defaultNow(),
      updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    },
    (table) => [
      index("jobs_user_id_stage_position_idx").on(
        table.userId,
        table.stage,
        table.position
      ),
      index("jobs_user_id_job_url_idx").on(table.userId, table.jobUrl),
    ]
  )

  const jobChecklist = opencvApp.table(
    "job_checklist",
    {
      id: uuid("id").primaryKey(),
      jobId: uuid("job_id")
        .notNull()
        .references(() => jobs.id, { onDelete: "cascade" }),
      label: text("label").notNull(),
      done: boolean("done").notNull().default(false),
      position: text("position").notNull(),
    },
    (table) => [
      index("job_checklist_job_id_idx").on(table.jobId, table.position),
    ]
  )

  return { jobs, jobChecklist }
}
