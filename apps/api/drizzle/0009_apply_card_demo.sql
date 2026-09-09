ALTER TABLE "openpath_app"."apply_cards" ADD COLUMN "demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "openpath_app"."apply_cards"
SET "demo" = true
WHERE (
  ("title" = 'Associate PM intern' AND "company" = 'Local startup')
  OR ("title" = 'Business analyst intern' AND "company" = 'Regional bank')
  OR ("title" = 'Product analyst intern' AND "company" = 'E-commerce co.')
  OR ("title" = 'UX research intern' AND "company" = 'Agency')
)
AND (
  "job_url" IS NULL
  OR "job_url" = ''
  OR "job_url" ILIKE '%jobs.example.com%'
);
