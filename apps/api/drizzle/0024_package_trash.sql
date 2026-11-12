CREATE TABLE "opencv_app"."paper_package_trash" (
	"doc_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"incarnation" uuid NOT NULL,
	"revision" uuid NOT NULL,
	"canvas_profile" text,
	"head_created_at" timestamp with time zone NOT NULL,
	"linked_jobs" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_package_trash" ADD CONSTRAINT "paper_package_trash_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_package_trash" ADD CONSTRAINT "paper_package_trash_version_fk" FOREIGN KEY ("doc_id","user_id","incarnation","revision") REFERENCES "opencv_app"."paper_package_versions"("doc_id","user_id","incarnation","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_package_trash_owner_idx" ON "opencv_app"."paper_package_trash" USING btree ("user_id");