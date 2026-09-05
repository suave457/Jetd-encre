CREATE TABLE `pilot_game_awards` (
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`game_id` text NOT NULL,
	`grid_id` text NOT NULL,
	`xp` integer NOT NULL,
	`completed_at` integer NOT NULL,
	PRIMARY KEY(`school_id`, `student_id`, `game_id`, `grid_id`),
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`,`student_id`,`game_id`,`grid_id`) REFERENCES `pilot_game_progress`(`school_id`,`student_id`,`game_id`,`grid_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_game_award_xp" CHECK("pilot_game_awards"."xp" in (20,35,50))
);
--> statement-breakpoint
CREATE TABLE `pilot_game_progress` (
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`game_id` text NOT NULL,
	`grid_id` text NOT NULL,
	`progress_json` text NOT NULL,
	`hint_count` integer NOT NULL,
	`revision` integer NOT NULL,
	`last_request_id` text NOT NULL,
	`last_request_hash` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`school_id`, `student_id`, `game_id`, `grid_id`),
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `pilot_memberships`(`school_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_game_progress_json" CHECK(json_valid("pilot_game_progress"."progress_json") and json_type("pilot_game_progress"."progress_json") = 'object'),
	CONSTRAINT "pilot_game_progress_hints" CHECK("pilot_game_progress"."hint_count" between 0 and 10000),
	CONSTRAINT "pilot_game_progress_revision" CHECK("pilot_game_progress"."revision" >= 1),
	CONSTRAINT "pilot_game_progress_request" CHECK(length("pilot_game_progress"."last_request_id") = 36 and length("pilot_game_progress"."last_request_hash") = 64)
);
