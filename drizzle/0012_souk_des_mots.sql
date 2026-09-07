CREATE TABLE `pilot_market_awards` (
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`game_id` text NOT NULL,
	`grid_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`mission_version` integer NOT NULL,
	`reward_type` text NOT NULL,
	`xp` integer NOT NULL,
	`awarded_at` integer NOT NULL,
	PRIMARY KEY(`school_id`, `student_id`, `mission_id`, `mission_version`, `reward_type`),
	FOREIGN KEY (`school_id`,`student_id`,`game_id`,`grid_id`) REFERENCES `pilot_game_progress`(`school_id`,`student_id`,`game_id`,`grid_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pilot_market_game" CHECK("pilot_market_awards"."game_id" = 'souk-des-mots' and "pilot_market_awards"."grid_id" = 'v1'),
	CONSTRAINT "pilot_market_reward" CHECK(("pilot_market_awards"."reward_type" = 'mastery' and "pilot_market_awards"."xp" = 10) or ("pilot_market_awards"."reward_type" = 'autonomy' and "pilot_market_awards"."xp" = 5)),
	CONSTRAINT "pilot_market_mission_version" CHECK("pilot_market_awards"."mission_version" >= 1)
);
