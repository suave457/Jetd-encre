CREATE TABLE `pilot_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`class_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text NOT NULL,
	`due_date` text NOT NULL,
	`created_at` integer NOT NULL,
	`request_key` text NOT NULL,
	`request_hash` text NOT NULL,
	FOREIGN KEY (`class_id`,`school_id`) REFERENCES `pilot_classes`(`id`,`school_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`teacher_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_assignment_id_school` ON `pilot_assignments` (`id`,`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_assignment_request_unique` ON `pilot_assignments` (`school_id`,`teacher_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `pilot_assignment_class_idx` ON `pilot_assignments` (`school_id`,`class_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `pilot_auth_flows` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`browser_hash` text NOT NULL,
	`verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pilot_auth_flow_expiry_idx` ON `pilot_auth_flows` (`expires_at`);--> statement-breakpoint
CREATE TABLE `pilot_class_members` (
	`school_id` text NOT NULL,
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`school_id`, `class_id`, `user_id`),
	FOREIGN KEY (`class_id`,`school_id`) REFERENCES `pilot_classes`(`id`,`school_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`user_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pilot_class_member_user_idx` ON `pilot_class_members` (`school_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `pilot_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `pilot_schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_class_school_unique` ON `pilot_classes` (`id`,`school_id`);--> statement-breakpoint
CREATE TABLE `pilot_family_links` (
	`school_id` text NOT NULL,
	`parent_id` text NOT NULL,
	`student_id` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`school_id`, `parent_id`, `student_id`),
	FOREIGN KEY (`school_id`,`parent_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_family_different_users" CHECK("pilot_family_links"."parent_id" <> "pilot_family_links"."student_id")
);
--> statement-breakpoint
CREATE TABLE `pilot_identities` (
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`issuer`, `subject`),
	FOREIGN KEY (`user_id`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pilot_identity_user_idx` ON `pilot_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `pilot_memberships` (
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`school_id`, `user_id`),
	FOREIGN KEY (`school_id`) REFERENCES `pilot_schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_membership_role" CHECK("pilot_memberships"."role" in ('enseignant','eleve','parent','directeur'))
);
--> statement-breakpoint
CREATE INDEX `pilot_membership_user_idx` ON `pilot_memberships` (`user_id`,`active`);--> statement-breakpoint
CREATE TABLE `pilot_reviews` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`score` integer NOT NULL,
	`feedback` text NOT NULL,
	`request_hash` text NOT NULL,
	`reviewed_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`,`school_id`) REFERENCES `pilot_submissions`(`id`,`school_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`teacher_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_review_score" CHECK("pilot_reviews"."score" >= 0 and "pilot_reviews"."score" <= 20)
);
--> statement-breakpoint
CREATE TABLE `pilot_schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pilot_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`csrf_token` text NOT NULL,
	`assurance` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_session_assurance" CHECK("pilot_sessions"."assurance" in ('oidc','local_fixture'))
);
--> statement-breakpoint
CREATE INDEX `pilot_session_user_idx` ON `pilot_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `pilot_session_expiry_idx` ON `pilot_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `pilot_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`student_id` text NOT NULL,
	`body` text NOT NULL,
	`request_hash` text NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`,`school_id`) REFERENCES `pilot_assignments`(`id`,`school_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_submission_id_school` ON `pilot_submissions` (`id`,`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_submission_once` ON `pilot_submissions` (`assignment_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `pilot_users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "pilot_users_active" CHECK("pilot_users"."active" in (0,1))
);
