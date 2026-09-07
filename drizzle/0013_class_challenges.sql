CREATE TABLE `pilot_class_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`class_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`student_id` text NOT NULL,
	`pseudonym` text NOT NULL,
	`state_json` text NOT NULL,
	`revision` integer NOT NULL,
	`start_request_id` text NOT NULL,
	`start_request_hash` text NOT NULL,
	`last_request_id` text NOT NULL,
	`last_request_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`challenge_id`,`school_id`,`class_id`) REFERENCES `pilot_class_challenges`(`id`,`school_id`,`class_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_class_attempt_state" CHECK(json_valid("pilot_class_attempts"."state_json") AND json_type("pilot_class_attempts"."state_json")='object'),
	CONSTRAINT "pilot_class_attempt_revision" CHECK("pilot_class_attempts"."revision" BETWEEN 1 AND 11)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_class_attempt_once` ON `pilot_class_attempts` (`challenge_id`,`student_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_class_attempt_alias` ON `pilot_class_attempts` (`challenge_id`,`pseudonym`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_class_attempt_owner` ON `pilot_class_attempts` (`id`,`school_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `pilot_class_awards` (
	`attempt_id` text NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`question_index` integer NOT NULL,
	`xp` integer NOT NULL,
	`awarded_at` integer NOT NULL,
	PRIMARY KEY(`attempt_id`, `question_index`),
	FOREIGN KEY (`attempt_id`,`school_id`,`student_id`) REFERENCES `pilot_class_attempts`(`id`,`school_id`,`student_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_class_award_value" CHECK("pilot_class_awards"."question_index" BETWEEN 0 AND 4 AND "pilot_class_awards"."xp"=10)
);
--> statement-breakpoint
CREATE INDEX `pilot_class_award_owner` ON `pilot_class_awards` (`school_id`,`student_id`,`awarded_at`);--> statement-breakpoint
CREATE TABLE `pilot_class_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`class_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`title` text NOT NULL,
	`class_label` text NOT NULL,
	`level` text NOT NULL,
	`theme` text NOT NULL,
	`bank_id` text NOT NULL,
	`content_version` text NOT NULL,
	`question_ids_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`closed_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`create_request_id` text NOT NULL,
	`create_request_hash` text NOT NULL,
	`close_request_id` text,
	`close_request_hash` text,
	FOREIGN KEY (`class_id`,`school_id`) REFERENCES `pilot_classes`(`id`,`school_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`teacher_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_class_challenge_dates" CHECK("pilot_class_challenges"."end_at">"pilot_class_challenges"."created_at" AND ("pilot_class_challenges"."closed_at" IS NULL OR "pilot_class_challenges"."closed_at">="pilot_class_challenges"."created_at")),
	CONSTRAINT "pilot_class_challenge_revision" CHECK("pilot_class_challenges"."revision" IN (1,2)),
	CONSTRAINT "pilot_class_challenge_questions" CHECK(json_valid("pilot_class_challenges"."question_ids_json") AND json_type("pilot_class_challenges"."question_ids_json")='array' AND json_array_length("pilot_class_challenges"."question_ids_json")=5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_class_challenge_scope` ON `pilot_class_challenges` (`id`,`school_id`,`class_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_class_challenge_create_once` ON `pilot_class_challenges` (`school_id`,`teacher_id`,`create_request_id`);--> statement-breakpoint
CREATE INDEX `pilot_class_challenge_list` ON `pilot_class_challenges` (`school_id`,`class_id`,`created_at`,`id`);