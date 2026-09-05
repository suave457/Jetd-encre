CREATE TABLE `pilot_auth_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pilot_auth_limits_window_idx` ON `pilot_auth_limits` (`window`);