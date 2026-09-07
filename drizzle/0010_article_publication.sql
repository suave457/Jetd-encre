CREATE TABLE `beta_article_publication_events` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`publication_no` integer NOT NULL,
	`action` text NOT NULL,
	`source_version_no` integer,
	`image_id` text,
	`image_alt` text,
	`request_hash` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`content_id`) REFERENCES `beta_editorial_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `pilot_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_id`,`source_version_no`) REFERENCES `beta_content_versions`(`content_id`,`version_no`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "beta_article_publication_no" CHECK("beta_article_publication_events"."publication_no">0),
	CONSTRAINT "beta_article_publication_action" CHECK(("beta_article_publication_events"."action"='publish' AND "beta_article_publication_events"."source_version_no" IS NOT NULL AND "beta_article_publication_events"."image_id" IS NOT NULL AND "beta_article_publication_events"."image_alt" IS NOT NULL) OR ("beta_article_publication_events"."action"='retract' AND "beta_article_publication_events"."source_version_no" IS NULL AND "beta_article_publication_events"."image_id" IS NULL AND "beta_article_publication_events"."image_alt" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_article_publication_revision` ON `beta_article_publication_events` (`content_id`,`publication_no`);--> statement-breakpoint
CREATE INDEX `beta_article_publication_date` ON `beta_article_publication_events` (`created_at`,`id`);