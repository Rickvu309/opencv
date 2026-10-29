ALTER TABLE "opencv_app"."chat_messages"
  ADD COLUMN "supersedes_message_id" uuid;
--> statement-breakpoint
ALTER TABLE "opencv_app"."chat_messages"
  ADD CONSTRAINT "chat_messages_supersedes_message_id_chat_messages_id_fk"
  FOREIGN KEY ("supersedes_message_id")
  REFERENCES "opencv_app"."chat_messages"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
WITH ordered AS (
  SELECT
    "id",
    "chat_id",
    "role",
    "created_at",
    count(*) FILTER (WHERE "role" = 'person') OVER (
      PARTITION BY "chat_id"
      ORDER BY "created_at", "id"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS turn_number
  FROM "opencv_app"."chat_messages"
), coach_rows AS (
  SELECT
    "id",
    lag("id") OVER (
      PARTITION BY "chat_id", turn_number
      ORDER BY "created_at", "id"
    ) AS predecessor_id
  FROM ordered
  WHERE "role" = 'coach'
)
UPDATE "opencv_app"."chat_messages" AS current
SET "supersedes_message_id" = coach_rows.predecessor_id
FROM coach_rows
WHERE current."id" = coach_rows."id"
  AND coach_rows.predecessor_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_supersedes_message_id_uidx"
  ON "opencv_app"."chat_messages" USING btree ("supersedes_message_id")
  WHERE "supersedes_message_id" IS NOT NULL;
