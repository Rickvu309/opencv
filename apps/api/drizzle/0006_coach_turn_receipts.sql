ALTER TABLE "opencv_app"."activity" ADD COLUMN "turn_id" uuid;--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD COLUMN "turn_id" uuid;--> statement-breakpoint
ALTER TABLE "opencv_app"."activity" ADD CONSTRAINT "activity_turn_id_coach_usage_id_fk" FOREIGN KEY ("turn_id") REFERENCES "opencv_app"."coach_usage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."pending_actions" ADD CONSTRAINT "pending_actions_turn_id_coach_usage_id_fk" FOREIGN KEY ("turn_id") REFERENCES "opencv_app"."coach_usage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_turn_id_idx" ON "opencv_app"."activity" USING btree ("turn_id") WHERE "opencv_app"."activity"."turn_id" is not null;--> statement-breakpoint
CREATE INDEX "pending_actions_turn_id_idx" ON "opencv_app"."pending_actions" USING btree ("turn_id") WHERE "opencv_app"."pending_actions"."turn_id" is not null;