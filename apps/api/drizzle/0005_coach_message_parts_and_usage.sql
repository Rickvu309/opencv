CREATE TABLE "openpath_app"."coach_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"thread_id" uuid,
	"message_id" uuid,
	"model" text NOT NULL,
	"tokens" integer,
	"cost_estimate" numeric,
	"latency_ms" integer,
	"finish_reason" text,
	"rating" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "openpath_app"."thread_messages" ADD COLUMN "parts" jsonb;--> statement-breakpoint
ALTER TABLE "openpath_app"."thread_messages" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "openpath_app"."thread_messages" ADD COLUMN "worked_ms" integer;--> statement-breakpoint
ALTER TABLE "openpath_app"."coach_usage" ADD CONSTRAINT "coach_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "openpath_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "openpath_app"."coach_usage" ADD CONSTRAINT "coach_usage_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "openpath_app"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "openpath_app"."coach_usage" ADD CONSTRAINT "coach_usage_message_id_thread_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "openpath_app"."thread_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_usage_user_id_created_at_idx" ON "openpath_app"."coach_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_usage_message_id_uidx" ON "openpath_app"."coach_usage" USING btree ("message_id");
