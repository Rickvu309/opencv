CREATE SCHEMA IF NOT EXISTS "opencv_app";
--> statement-breakpoint
CREATE TABLE "opencv_app"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"command" text NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb,
	"result" jsonb,
	"reversal_command" text,
	"reversal_input" jsonb,
	"undone_at" timestamp with time zone,
	"idempotency_key" text
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."chat_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"parts" jsonb,
	"status" text,
	"worked_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."chats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"focus_kind" text,
	"focus_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."coach_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" uuid,
	"message_id" uuid,
	"plan" text NOT NULL,
	"mode" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"finish_reason" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"email" text,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"status" text DEFAULT 'active' NOT NULL,
	"sync_cursor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"purpose" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."inbox_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"provider_message_id" text NOT NULL,
	"direction" text NOT NULL,
	"from_name" text,
	"from_email" text,
	"to_email" text,
	"body_text" text DEFAULT '' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."inbox_threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" uuid,
	"provider_thread_id" text NOT NULL,
	"job_id" uuid,
	"company" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"last_message_at" timestamp with time zone,
	"unread" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"snooze_until" timestamp with time zone,
	"suggested_stage" text,
	"draft_body" text,
	"draft_times" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."job_checklist" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"stage" text DEFAULT 'saved' NOT NULL,
	"position" text NOT NULL,
	"location" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"job_url" text,
	"source_host" text,
	"description" text,
	"posting" jsonb,
	"interview_at" timestamp with time zone,
	"deadline" date,
	"recruiter_name" text,
	"recruiter_email" text,
	"cv_doc_id" uuid,
	"letter_doc_id" uuid,
	"starred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."notify_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"topic" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."paper_docs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"template_id" text,
	"document" jsonb NOT NULL,
	"content_version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"checks" jsonb,
	"page_choice" text DEFAULT 'unset' NOT NULL,
	"source_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."paper_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"doc_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paper_shares_doc_id_unique" UNIQUE("doc_id"),
	CONSTRAINT "paper_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."pending_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" uuid NOT NULL,
	"command" text NOT NULL,
	"input" jsonb NOT NULL,
	"summary" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"coach_mode" text DEFAULT 'free' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"time_zone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"start_page" text DEFAULT 'apply' NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_browser" boolean DEFAULT false NOT NULL,
	"memory_enabled" boolean DEFAULT true NOT NULL,
	"agent_chat" boolean DEFAULT true NOT NULL,
	"agent_cvs" boolean DEFAULT true NOT NULL,
	"agent_interview" boolean DEFAULT true NOT NULL,
	"agent_email" boolean DEFAULT true NOT NULL,
	"agent_weekly" boolean DEFAULT false NOT NULL,
	"welcomed_at" timestamp with time zone,
	"inbox_skipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opencv_app"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."chat_messages" ADD CONSTRAINT "chat_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "opencv_app"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."chats" ADD CONSTRAINT "chats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_usage" ADD CONSTRAINT "coach_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_usage" ADD CONSTRAINT "coach_usage_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "opencv_app"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_usage" ADD CONSTRAINT "coach_usage_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "opencv_app"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."connections" ADD CONSTRAINT "connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."files" ADD CONSTRAINT "files_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."inbox_messages" ADD CONSTRAINT "inbox_messages_thread_id_inbox_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "opencv_app"."inbox_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."inbox_threads" ADD CONSTRAINT "inbox_threads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."inbox_threads" ADD CONSTRAINT "inbox_threads_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "opencv_app"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."inbox_threads" ADD CONSTRAINT "inbox_threads_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "opencv_app"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."job_checklist" ADD CONSTRAINT "job_checklist_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "opencv_app"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."jobs" ADD CONSTRAINT "jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."jobs" ADD CONSTRAINT "jobs_cv_doc_id_paper_docs_id_fk" FOREIGN KEY ("cv_doc_id") REFERENCES "opencv_app"."paper_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."jobs" ADD CONSTRAINT "jobs_letter_doc_id_paper_docs_id_fk" FOREIGN KEY ("letter_doc_id") REFERENCES "opencv_app"."paper_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."notify_requests" ADD CONSTRAINT "notify_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD CONSTRAINT "paper_docs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_docs" ADD CONSTRAINT "paper_docs_source_file_id_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "opencv_app"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_shares" ADD CONSTRAINT "paper_shares_doc_id_paper_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "opencv_app"."paper_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD CONSTRAINT "pending_actions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD CONSTRAINT "pending_actions_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "opencv_app"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "opencv_app"."account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "opencv_app"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_user_subject_idx" ON "opencv_app"."activity" USING btree ("user_id","subject_kind","subject_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_user_idempotency_uidx" ON "opencv_app"."activity" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "chat_messages_chat_id_created_at_idx" ON "opencv_app"."chat_messages" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "chats_user_id_updated_at_idx" ON "opencv_app"."chats" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "chats_user_id_focus_idx" ON "opencv_app"."chats" USING btree ("user_id","focus_kind","focus_id");--> statement-breakpoint
CREATE INDEX "coach_usage_user_id_created_at_idx" ON "opencv_app"."coach_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_usage_message_id_uidx" ON "opencv_app"."coach_usage" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_user_provider_uidx" ON "opencv_app"."connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "files_user_id_idx" ON "opencv_app"."files" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_messages_thread_provider_uidx" ON "opencv_app"."inbox_messages" USING btree ("thread_id","provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_threads_connection_provider_uidx" ON "opencv_app"."inbox_threads" USING btree ("connection_id","provider_thread_id");--> statement-breakpoint
CREATE INDEX "job_checklist_job_id_idx" ON "opencv_app"."job_checklist" USING btree ("job_id","position");--> statement-breakpoint
CREATE INDEX "jobs_user_id_stage_position_idx" ON "opencv_app"."jobs" USING btree ("user_id","stage","position");--> statement-breakpoint
CREATE INDEX "jobs_user_id_job_url_idx" ON "opencv_app"."jobs" USING btree ("user_id","job_url");--> statement-breakpoint
CREATE UNIQUE INDEX "notify_requests_user_topic_uidx" ON "opencv_app"."notify_requests" USING btree ("user_id","topic");--> statement-breakpoint
CREATE INDEX "paper_docs_user_id_updated_at_idx" ON "opencv_app"."paper_docs" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "pending_actions_user_id_idx" ON "opencv_app"."pending_actions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "opencv_app"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "opencv_app"."verification" USING btree ("identifier");