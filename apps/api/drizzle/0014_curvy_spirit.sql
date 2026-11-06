CREATE TABLE "opencv_app"."coach_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"chat_id" uuid NOT NULL,
	"source_message_id" uuid,
	"assistant_message_id" uuid,
	"supersedes_message_id" uuid,
	"start_key" text NOT NULL,
	"start_input_hash" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"catalog_digest" text NOT NULL,
	"runtime_version" integer NOT NULL,
	"model_id" text NOT NULL,
	"mode" text NOT NULL,
	"plan_at_start" text NOT NULL,
	"tools_allowed" boolean NOT NULL,
	"context_snapshot" jsonb NOT NULL,
	"lease_owner" text,
	"lease_epoch" bigint DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"cancel_processed_at" timestamp with time zone,
	"attempt" integer DEFAULT 0 NOT NULL,
	"next_seq" bigint DEFAULT 0 NOT NULL,
	"checkpoint_version" integer DEFAULT 0 NOT NULL,
	"max_steps" integer NOT NULL,
	"max_tokens" integer NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "coach_tasks_assistant_message_id_unique" UNIQUE("assistant_message_id"),
	CONSTRAINT "coach_tasks_state_check" CHECK ("opencv_app"."coach_tasks"."state" in ('queued','running','waitingApproval','cancelling','cancelled','succeeded','failed')),
	CONSTRAINT "coach_tasks_bounds_check" CHECK ("opencv_app"."coach_tasks"."lease_epoch" >= 0 and "opencv_app"."coach_tasks"."next_seq" >= 0 and "opencv_app"."coach_tasks"."max_steps" > 0 and "opencv_app"."coach_tasks"."max_tokens" > 0)
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."task_checkpoints" (
	"task_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"completed_step" integer NOT NULL,
	"phase" text NOT NULL,
	"attempt" integer NOT NULL,
	"model_messages" jsonb NOT NULL,
	"observed_revisions" jsonb NOT NULL,
	"usage" jsonb NOT NULL,
	"request_manifest" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_checkpoints_task_id_version_pk" PRIMARY KEY("task_id","version")
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."task_events" (
	"task_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"epoch" bigint NOT NULL,
	"attempt" integer NOT NULL,
	"step" integer,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"logical_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_events_task_id_seq_pk" PRIMARY KEY("task_id","seq")
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."tool_intents" (
	"task_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"slot" integer NOT NULL,
	"intent_key" text NOT NULL,
	"provider_tool_use_id" text NOT NULL,
	"operation" text NOT NULL,
	"operation_version" integer NOT NULL,
	"input" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"observed_revisions" jsonb NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'planned' NOT NULL,
	"proposal_id" uuid,
	"activity_id" uuid,
	"public_result" jsonb,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "tool_intents_task_id_step_slot_pk" PRIMARY KEY("task_id","step","slot"),
	CONSTRAINT "tool_intents_intent_key_unique" UNIQUE("intent_key"),
	CONSTRAINT "tool_intents_proposal_id_unique" UNIQUE("proposal_id"),
	CONSTRAINT "tool_intents_key_check" CHECK ("opencv_app"."tool_intents"."intent_key" = 'coach:' || "opencv_app"."tool_intents"."task_id"::text || ':' || "opencv_app"."tool_intents"."step"::text || ':' || "opencv_app"."tool_intents"."slot"::text),
	CONSTRAINT "tool_intents_slot_check" CHECK ("opencv_app"."tool_intents"."step" >= 0 and "opencv_app"."tool_intents"."slot" >= 0)
);
--> statement-breakpoint
ALTER TABLE "opencv_app"."chat_messages" ADD COLUMN "coach_task_id" uuid;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_usage" ADD COLUMN "coach_task_id" uuid;--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD COLUMN "coach_task_id" uuid;--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD COLUMN "coach_intent_key" text;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_tasks" ADD CONSTRAINT "coach_tasks_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_tasks" ADD CONSTRAINT "coach_tasks_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "opencv_app"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_tasks" ADD CONSTRAINT "coach_tasks_source_message_id_chat_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "opencv_app"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_tasks" ADD CONSTRAINT "coach_tasks_assistant_message_id_chat_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "opencv_app"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_tasks" ADD CONSTRAINT "coach_tasks_supersedes_message_id_chat_messages_id_fk" FOREIGN KEY ("supersedes_message_id") REFERENCES "opencv_app"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."task_checkpoints" ADD CONSTRAINT "task_checkpoints_task_id_coach_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "opencv_app"."coach_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."task_events" ADD CONSTRAINT "task_events_task_id_coach_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "opencv_app"."coach_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."tool_intents" ADD CONSTRAINT "tool_intents_task_id_coach_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "opencv_app"."coach_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."tool_intents" ADD CONSTRAINT "tool_intents_proposal_id_pending_actions_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "opencv_app"."pending_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."tool_intents" ADD CONSTRAINT "tool_intents_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "opencv_app"."activity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_tasks_start_key_uidx" ON "opencv_app"."coach_tasks" USING btree ("owner_id","start_key");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_tasks_active_chat_uidx" ON "opencv_app"."coach_tasks" USING btree ("owner_id","chat_id") WHERE "opencv_app"."coach_tasks"."state" not in ('cancelled', 'succeeded', 'failed');--> statement-breakpoint
CREATE INDEX "coach_tasks_eligible_idx" ON "opencv_app"."coach_tasks" USING btree ("state","available_at","lease_until");--> statement-breakpoint
CREATE UNIQUE INDEX "task_events_logical_uidx" ON "opencv_app"."task_events" USING btree ("task_id","logical_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_intents_provider_uidx" ON "opencv_app"."tool_intents" USING btree ("task_id","step","provider_tool_use_id");--> statement-breakpoint
CREATE INDEX "tool_intents_state_idx" ON "opencv_app"."tool_intents" USING btree ("task_id","state");--> statement-breakpoint
ALTER TABLE "opencv_app"."chat_messages" ADD CONSTRAINT "chat_messages_coach_task_id_coach_tasks_id_fk" FOREIGN KEY ("coach_task_id") REFERENCES "opencv_app"."coach_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_usage" ADD CONSTRAINT "coach_usage_coach_task_id_coach_tasks_id_fk" FOREIGN KEY ("coach_task_id") REFERENCES "opencv_app"."coach_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD CONSTRAINT "pending_actions_coach_task_id_coach_tasks_id_fk" FOREIGN KEY ("coach_task_id") REFERENCES "opencv_app"."coach_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."chat_messages" ADD CONSTRAINT "chat_messages_coach_task_id_unique" UNIQUE("coach_task_id");--> statement-breakpoint
ALTER TABLE "opencv_app"."coach_usage" ADD CONSTRAINT "coach_usage_coach_task_id_unique" UNIQUE("coach_task_id");--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD CONSTRAINT "pending_actions_coach_intent_key_unique" UNIQUE("coach_intent_key");
--> statement-breakpoint
CREATE FUNCTION "opencv_app"."guard_coach_task"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.state IN ('cancelled','succeeded','failed') AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Terminal task is immutable';
    END IF;
    IF OLD.cancel_requested_at IS NOT NULL AND NEW.cancel_requested_at IS DISTINCT FROM OLD.cancel_requested_at THEN
      RAISE EXCEPTION 'Cancellation is monotonic';
    END IF;
    IF NEW.lease_epoch < OLD.lease_epoch OR NEW.next_seq < OLD.next_seq THEN
      RAISE EXCEPTION 'Task counters are monotonic';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM opencv_app.chats c WHERE c.id = NEW.chat_id AND c.user_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'Task chat owner mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM opencv_app.chat_messages m WHERE m.id IN (NEW.source_message_id, NEW.assistant_message_id, NEW.supersedes_message_id) AND m.chat_id <> NEW.chat_id) THEN
    RAISE EXCEPTION 'Task message chat mismatch';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "guard_coach_task" BEFORE INSERT OR UPDATE ON "opencv_app"."coach_tasks" FOR EACH ROW EXECUTE FUNCTION "opencv_app"."guard_coach_task"();
--> statement-breakpoint
CREATE FUNCTION "opencv_app"."guard_tool_intent"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.task_id,NEW.step,NEW.slot,NEW.intent_key,NEW.provider_tool_use_id,NEW.operation,NEW.operation_version,NEW.input,NEW.input_hash,NEW.observed_revisions,NEW.kind) IS DISTINCT FROM ROW(OLD.task_id,OLD.step,OLD.slot,OLD.intent_key,OLD.provider_tool_use_id,OLD.operation,OLD.operation_version,OLD.input,OLD.input_hash,OLD.observed_revisions,OLD.kind) THEN
    RAISE EXCEPTION 'Intent identity is immutable';
  END IF;
  IF OLD.state NOT IN ('planned','proposed') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Intent result is immutable';
  END IF;
  IF OLD.state = 'proposed' AND NEW.state = 'planned' THEN
    RAISE EXCEPTION 'Intent proposal cannot restart';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "guard_tool_intent" BEFORE UPDATE ON "opencv_app"."tool_intents" FOR EACH ROW EXECUTE FUNCTION "opencv_app"."guard_tool_intent"();
