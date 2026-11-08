CREATE TABLE "opencv_app"."paper_package_heads" (
	"doc_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"incarnation" uuid NOT NULL,
	"revision" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opencv_app"."paper_package_versions" (
	"revision" uuid PRIMARY KEY NOT NULL,
	"parent_revision" uuid,
	"doc_id" uuid NOT NULL,
	"incarnation" uuid NOT NULL,
	"user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"file_id" uuid NOT NULL,
	"package_hash" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sidecar" jsonb NOT NULL,
	"sidecar_hash" text NOT NULL,
	"projection" jsonb NOT NULL,
	"projection_hash" text NOT NULL,
	"projector" text NOT NULL,
	"cursor_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paper_package_identity_idx" UNIQUE("doc_id","user_id","incarnation","revision"),
	CONSTRAINT "paper_package_byte_size" CHECK ("opencv_app"."paper_package_versions"."byte_size" > 0 AND "opencv_app"."paper_package_versions"."byte_size" <= 8388608),
	CONSTRAINT "paper_package_kind" CHECK ("opencv_app"."paper_package_versions"."kind" IN ('cv', 'letter'))
);
--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_package_heads" ADD CONSTRAINT "paper_package_heads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_package_heads" ADD CONSTRAINT "paper_package_head_version_fk" FOREIGN KEY ("doc_id","user_id","incarnation","revision") REFERENCES "opencv_app"."paper_package_versions"("doc_id","user_id","incarnation","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_package_versions" ADD CONSTRAINT "paper_package_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opencv_app"."paper_package_versions" ADD CONSTRAINT "paper_package_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "opencv_app"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_package_heads_owner_idx" ON "opencv_app"."paper_package_heads" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_package_request_idx" ON "opencv_app"."paper_package_versions" USING btree ("user_id","request_id");