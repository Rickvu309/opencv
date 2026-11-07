DO $$
BEGIN
CREATE TABLE "opencv_app"."agent_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"tool" text NOT NULL,
	"input_hash" text NOT NULL,
	"outcome" text NOT NULL,
	"proposal_id" uuid,
	"charged" boolean NOT NULL
);

ALTER TABLE "opencv_app"."agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "opencv_app"."agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_connection_id_agent_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "opencv_app"."agent_connections"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "agent_tool_calls_owner_window" ON "opencv_app"."agent_tool_calls" USING btree ("user_id","created_at");
CREATE INDEX "agent_tool_calls_connection_window" ON "opencv_app"."agent_tool_calls" USING btree ("connection_id","created_at");
END;
$$;
