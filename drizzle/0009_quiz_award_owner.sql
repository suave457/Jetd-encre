-- Preserve all existing rewards; reject inconsistent ownership rather than discard it.
CREATE UNIQUE INDEX `pilot_quiz_attempt_owner` ON `pilot_quiz_attempts` (`id`,`school_id`,`student_id`,`game_id`);
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
	FOREIGN KEY (`attempt_id`,`school_id`,`student_id`,`game_id`) REFERENCES `pilot_quiz_attempts`(`id`,`school_id`,`student_id`,`game_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_quiz_award_xp" CHECK("__new_pilot_quiz_awards"."xp" in (10,20))
);
--> statement-breakpoint
INSERT INTO `__new_pilot_quiz_awards`("school_id", "student_id", "game_id", "reward_key", "attempt_id", "xp", "awarded_at") SELECT "school_id", "student_id", "game_id", "reward_key", "attempt_id", "xp", "awarded_at" FROM `pilot_quiz_awards`;--> statement-breakpoint
DROP TABLE `pilot_quiz_awards`;--> statement-breakpoint
ALTER TABLE `__new_pilot_quiz_awards` RENAME TO `pilot_quiz_awards`;--> statement-breakpoint
