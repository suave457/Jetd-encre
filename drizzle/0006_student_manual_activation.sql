CREATE TABLE `pilot_manual_attempts` (
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`bucket` integer NOT NULL,
	`attempts` integer NOT NULL,
	PRIMARY KEY(`school_id`, `student_id`),
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_manual_attempt_bound" CHECK("pilot_manual_attempts"."attempts" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE `pilot_manual_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`manual_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`student_id` text,
	`activated_at` integer,
	FOREIGN KEY (`school_id`) REFERENCES `pilot_schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manual_id`) REFERENCES `pilot_manuals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_manual_code_digest" CHECK(length("pilot_manual_codes"."code_hash") = 64),
	CONSTRAINT "pilot_manual_code_claim" CHECK(("pilot_manual_codes"."student_id" is null and "pilot_manual_codes"."activated_at" is null) or ("pilot_manual_codes"."student_id" is not null and "pilot_manual_codes"."activated_at" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_manual_code_hash` ON `pilot_manual_codes` (`code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_manual_student_access` ON `pilot_manual_codes` (`school_id`,`student_id`,`manual_id`) WHERE "pilot_manual_codes"."revoked_at" is null and "pilot_manual_codes"."student_id" is not null;--> statement-breakpoint
CREATE TABLE `pilot_manuals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`level` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pilot_manual_active" CHECK("pilot_manuals"."active" in (0,1))
);
--> statement-breakpoint
ALTER TABLE `pilot_auth_flows` ADD `return_path` text;