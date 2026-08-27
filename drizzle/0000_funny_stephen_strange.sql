CREATE TABLE `beta_action_resolutions` (
	`action_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`actor_key` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE TABLE `beta_audit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_key` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`summary` text NOT NULL,
	`request_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `beta_audit_created_idx` ON `beta_audit_entries` (`created_at`,`action`);--> statement-breakpoint
CREATE TABLE `beta_content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`payload_json` text NOT NULL,
	`checksum` text NOT NULL,
	`reason` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`content_id`) REFERENCES `beta_editorial_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_content_version_unique_idx` ON `beta_content_versions` (`content_id`,`version_no`);--> statement-breakpoint
CREATE INDEX `beta_content_versions_content_idx` ON `beta_content_versions` (`content_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `beta_editorial_items` (
	`id` text PRIMARY KEY NOT NULL,
	`item_type` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`level_code` text,
	`audience` text DEFAULT 'private' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`current_version_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE INDEX `beta_editorial_filters_idx` ON `beta_editorial_items` (`item_type`,`status`,`level_code`,`updated_at`);--> statement-breakpoint
CREATE TABLE `beta_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`event_name` text NOT NULL,
	`occurred_at` text NOT NULL,
	`received_at` text NOT NULL,
	`subject_key` text NOT NULL,
	`role` text NOT NULL,
	`tenant_key` text NOT NULL,
	`class_key` text,
	`session_id` text,
	`content_id` text,
	`content_version` integer,
	`activity_id` text,
	`attempt_id` text,
	`competency_codes_json` text DEFAULT '[]' NOT NULL,
	`properties_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `beta_events_time_idx` ON `beta_events` (`tenant_key`,`occurred_at`,`event_name`);--> statement-breakpoint
CREATE INDEX `beta_events_subject_idx` ON `beta_events` (`tenant_key`,`subject_key`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `beta_import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`import_type` text NOT NULL,
	`file_name` text NOT NULL,
	`status` text NOT NULL,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`valid_rows` integer DEFAULT 0 NOT NULL,
	`invalid_rows` integer DEFAULT 0 NOT NULL,
	`summary_json` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	`rolled_back_at` text
);
--> statement-breakpoint
CREATE INDEX `beta_import_jobs_status_idx` ON `beta_import_jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `beta_kpi_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_key` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_key` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`value_milli` integer NOT NULL,
	`numerator` integer DEFAULT 0 NOT NULL,
	`denominator` integer DEFAULT 0 NOT NULL,
	`source_status` text DEFAULT 'fixture' NOT NULL,
	`calculated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_kpi_scope_period_idx` ON `beta_kpi_snapshots` (`metric_key`,`scope_type`,`scope_key`,`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `beta_media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer DEFAULT 0 NOT NULL,
	`checksum_sha256` text,
	`alt_text` text,
	`transcript_key` text,
	`source_label` text,
	`credit` text,
	`license_type` text,
	`license_expires_at` text,
	`status` text DEFAULT 'uploading' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_media_assets_r2_key_unique` ON `beta_media_assets` (`r2_key`);--> statement-breakpoint
CREATE INDEX `beta_media_status_idx` ON `beta_media_assets` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `beta_reference_items` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`system` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_reference_family_code_idx` ON `beta_reference_items` (`family`,`code`);