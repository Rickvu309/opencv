CREATE TABLE "opencv_app"."auth_limit_counters" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_limit_counters_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE INDEX "auth_limit_counters_expires_at_idx" ON "opencv_app"."auth_limit_counters" USING btree ("expires_at");