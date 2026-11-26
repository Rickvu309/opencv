import type { CoachMode } from "@workspace/domain/coach"
import {
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
  type PgSchema,
} from "drizzle-orm/pg-core"

export function createCoachUsageTable(
  opencvApp: PgSchema<"opencv_app">,
  refs: {
    user: { id: AnyPgColumn }
    chats: { id: AnyPgColumn }
    chatMessages: { id: AnyPgColumn }
    coachTasks: { id: AnyPgColumn }
  }
) {
  const { user, chats, chatMessages, coachTasks } = refs
  const timestamptz = (name: string) =>
    timestamp(name, { withTimezone: true, mode: "date" })
  const coachUsage = opencvApp.table(
    "coach_usage",
    {
      id: uuid("id").primaryKey(),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      chatId: uuid("chat_id").references(() => chats.id, {
        onDelete: "set null",
      }),
      messageId: uuid("message_id").references(() => chatMessages.id, {
        onDelete: "set null",
      }),
      coachTaskId: uuid("coach_task_id")
        .unique()
        .references((): AnyPgColumn => coachTasks.id),
      plan: text("plan").$type<"free" | "pro">().notNull(),
      mode: text("mode").$type<CoachMode>().notNull(),
      provider: text("provider").notNull(),
      model: text("model").notNull(),
      finishReason: text("finish_reason"),
      latencyMs: integer("latency_ms"),
      createdAt: timestamptz("created_at").notNull().defaultNow(),
    },
    (table) => [
      index("coach_usage_user_id_created_at_idx").on(
        table.userId,
        table.createdAt
      ),
      uniqueIndex("coach_usage_message_id_uidx").on(table.messageId),
    ]
  )

  return coachUsage
}
