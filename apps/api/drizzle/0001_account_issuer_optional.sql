DROP INDEX "opencv_app"."account_issuer_account_id_uidx";
--> statement-breakpoint
ALTER TABLE "opencv_app"."account" ALTER COLUMN "issuer" DROP NOT NULL;
