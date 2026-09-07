CREATE TABLE `pilot_library_assignments` (
	`manual_id` text NOT NULL,
	`school_id` text NOT NULL,
	`active` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`manual_id`, `school_id`),
	FOREIGN KEY (`manual_id`) REFERENCES `pilot_manuals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `pilot_schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_library_assignment_active" CHECK("pilot_library_assignments"."active" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `pilot_library_documents` (
	`manual_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`assignment_mode` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`manual_id`) REFERENCES `pilot_manuals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_library_revision" CHECK("pilot_library_documents"."revision">0),
	CONSTRAINT "pilot_library_mode" CHECK("pilot_library_documents"."assignment_mode" IN ('legacy','explicit'))
);
--> statement-breakpoint
CREATE TABLE `pilot_library_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`manual_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`state` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_library_operation_hash" CHECK(length("pilot_library_operations"."request_hash")=64),
	CONSTRAINT "pilot_library_operation_state" CHECK("pilot_library_operations"."state" IN ('applying','committed')),
	CONSTRAINT "pilot_library_operation_result" CHECK(json_valid("pilot_library_operations"."result_json"))
);
--> statement-breakpoint
CREATE TABLE `pilot_library_versions` (
	`manual_id` text NOT NULL,
	`sha256` text NOT NULL,
	`version_no` integer NOT NULL,
	`storage_key` text NOT NULL,
	`byte_size` integer NOT NULL,
	`page_count` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`manual_id`, `sha256`),
	FOREIGN KEY (`manual_id`) REFERENCES `pilot_manuals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_library_version_file" CHECK(length("pilot_library_versions"."sha256")=64 AND "pilot_library_versions"."storage_key"="pilot_library_versions"."sha256"||'.pdf' AND "pilot_library_versions"."byte_size" BETWEEN 1 AND 209715200 AND "pilot_library_versions"."page_count" BETWEEN 1 AND 2000 AND "pilot_library_versions"."version_no">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_library_version_number` ON `pilot_library_versions` (`manual_id`,`version_no`);