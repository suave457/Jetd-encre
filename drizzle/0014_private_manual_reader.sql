CREATE TABLE `pilot_manual_files` (
	`manual_id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`page_count` integer NOT NULL,
	`scope` text DEFAULT 'local_test' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`manual_id`) REFERENCES `pilot_manuals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_manual_file_scope" CHECK("pilot_manual_files"."scope"='local_test'),
	CONSTRAINT "pilot_manual_file_size" CHECK("pilot_manual_files"."byte_size">0 AND "pilot_manual_files"."byte_size"<=209715200 AND "pilot_manual_files"."page_count" BETWEEN 1 AND 2000),
	CONSTRAINT "pilot_manual_file_digest" CHECK(length("pilot_manual_files"."sha256")=64 AND "pilot_manual_files"."storage_key"="pilot_manual_files"."sha256"||'.pdf')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_manual_file_key` ON `pilot_manual_files` (`storage_key`);