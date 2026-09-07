-- Rebuild both sides of the ownership relation with foreign keys enabled.
-- Every existing attempt and reward must survive; inconsistent ownership aborts the transaction.
CREATE TABLE `__new_pilot_quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`game_id` text NOT NULL,
	`content_version` text NOT NULL,
	`daily_key` text,
	`question_ids_json` text NOT NULL,
	`state_json` text NOT NULL,
	`revision` integer NOT NULL,
	`start_request_id` text NOT NULL,
	`start_request_hash` text NOT NULL,
	`last_request_id` text NOT NULL,
	`last_request_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_quiz_game" CHECK("__new_pilot_quiz_attempts"."game_id" in ('culture-generale','defi-du-jour','mot-juste')),
	CONSTRAINT "pilot_quiz_question_ids_json" CHECK(json_valid("__new_pilot_quiz_attempts"."question_ids_json") and json_type("__new_pilot_quiz_attempts"."question_ids_json") = 'array'),
	CONSTRAINT "pilot_quiz_state_json" CHECK(json_valid("__new_pilot_quiz_attempts"."state_json") and json_type("__new_pilot_quiz_attempts"."state_json") = 'object'),
	CONSTRAINT "pilot_quiz_revision" CHECK("__new_pilot_quiz_attempts"."revision" >= 1),
	CONSTRAINT "pilot_quiz_daily_key" CHECK(("__new_pilot_quiz_attempts"."game_id" = 'defi-du-jour' and "__new_pilot_quiz_attempts"."daily_key" is not null) or ("__new_pilot_quiz_attempts"."game_id" in ('culture-generale','mot-juste') and "__new_pilot_quiz_attempts"."daily_key" is null))
);
--> statement-breakpoint
INSERT INTO `__new_pilot_quiz_attempts`(rowid, "id", "school_id", "student_id", "game_id", "content_version", "daily_key", "question_ids_json", "state_json", "revision", "start_request_id", "start_request_hash", "last_request_id", "last_request_hash", "created_at", "expires_at", "completed_at") SELECT rowid, "id", "school_id", "student_id", "game_id", "content_version", "daily_key", "question_ids_json", "state_json", "revision", "start_request_id", "start_request_hash", "last_request_id", "last_request_hash", "created_at", "expires_at", "completed_at" FROM `pilot_quiz_attempts`;--> statement-breakpoint
CREATE UNIQUE INDEX `__mot_juste_attempt_owner` ON `__new_pilot_quiz_attempts` (`id`,`school_id`,`student_id`,`game_id`);
--> statement-breakpoint
CREATE TABLE `__new_pilot_quiz_awards` (
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`game_id` text NOT NULL,
	`reward_key` text NOT NULL,
	`attempt_id` text NOT NULL,
	`xp` integer NOT NULL,
	`awarded_at` integer NOT NULL,
	PRIMARY KEY(`school_id`, `student_id`, `game_id`, `reward_key`),
	FOREIGN KEY (`attempt_id`,`school_id`,`student_id`,`game_id`) REFERENCES `__new_pilot_quiz_attempts`(`id`,`school_id`,`student_id`,`game_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_quiz_award_xp" CHECK("__new_pilot_quiz_awards"."xp" in (10,20))
);
--> statement-breakpoint
INSERT INTO `__new_pilot_quiz_awards`("school_id", "student_id", "game_id", "reward_key", "attempt_id", "xp", "awarded_at") SELECT "school_id", "student_id", "game_id", "reward_key", "attempt_id", "xp", "awarded_at" FROM `pilot_quiz_awards`;--> statement-breakpoint

DROP TABLE `pilot_quiz_awards`;
--> statement-breakpoint
DROP TABLE `pilot_quiz_attempts`;--> statement-breakpoint
ALTER TABLE `__new_pilot_quiz_attempts` RENAME TO `pilot_quiz_attempts`;--> statement-breakpoint
ALTER TABLE `__new_pilot_quiz_awards` RENAME TO `pilot_quiz_awards`;
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_quiz_daily_once` ON `pilot_quiz_attempts` (`school_id`,`student_id`,`game_id`,`daily_key`) WHERE "pilot_quiz_attempts"."daily_key" is not null;--> statement-breakpoint
CREATE INDEX `pilot_quiz_owner_time` ON `pilot_quiz_attempts` (`school_id`,`student_id`,`game_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_quiz_attempt_owner` ON `pilot_quiz_attempts` (`id`,`school_id`,`student_id`,`game_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_quiz_attempts_school_id_student_id_game_id_start_request_id_unique` ON `pilot_quiz_attempts` (`school_id`,`student_id`,`game_id`,`start_request_id`);
--> statement-breakpoint
DROP INDEX `__mot_juste_attempt_owner`;
