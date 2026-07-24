CREATE TABLE `ai_recommendation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`summary` text,
	`rationale` text,
	`input_context` text,
	`proposed_changes` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_at` integer,
	`rejected_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_recommendation_user_idx` ON `ai_recommendation` (`user_id`);--> statement-breakpoint
CREATE TABLE `approval_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recommendation_id` text,
	`request_summary` text,
	`proposed_change` text,
	`applied_change` text,
	`approved` integer DEFAULT true NOT NULL,
	`reversible` integer DEFAULT true NOT NULL,
	`reverted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recommendation_id`) REFERENCES `ai_recommendation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `approval_history_user_idx` ON `approval_history` (`user_id`);--> statement-breakpoint
CREATE TABLE `bookmark` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`place_id` text NOT NULL,
	`boundary_id` text,
	`theme_id` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`save_reason` text,
	`status` text DEFAULT 'saved' NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`revisit_intent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`boundary_id`) REFERENCES `boundary`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`theme_id`) REFERENCES `theme`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_user_place_unq` ON `bookmark` (`user_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `bookmark_user_idx` ON `bookmark` (`user_id`);--> statement-breakpoint
CREATE INDEX `bookmark_boundary_idx` ON `bookmark` (`boundary_id`);--> statement-breakpoint
CREATE INDEX `bookmark_theme_idx` ON `bookmark` (`theme_id`);--> statement-breakpoint
CREATE TABLE `boundary` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`radius_m` integer NOT NULL,
	`color` text DEFAULT '#587462' NOT NULL,
	`icon` text DEFAULT '⌖' NOT NULL,
	`description` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `boundary_user_idx` ON `boundary` (`user_id`);--> statement-breakpoint
CREATE TABLE `map_note` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`boundary_id` text,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`callout` text DEFAULT '' NOT NULL,
	`checklist` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`boundary_id`) REFERENCES `boundary`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `map_note_user_idx` ON `map_note` (`user_id`);--> statement-breakpoint
CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bookmark_id` text NOT NULL,
	`topic` text,
	`title` text,
	`original_content` text DEFAULT '' NOT NULL,
	`ai_organized_content` text,
	`author` text DEFAULT 'user' NOT NULL,
	`ai_status` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmark`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_bookmark_idx` ON `note` (`bookmark_id`);--> statement-breakpoint
CREATE INDEX `note_user_idx` ON `note` (`user_id`);--> statement-breakpoint
CREATE TABLE `place` (
	`id` text PRIMARY KEY NOT NULL,
	`google_place_id` text,
	`name` text NOT NULL,
	`address` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`category` text,
	`google_maps_url` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`last_verified_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_google_place_id_unq` ON `place` (`google_place_id`);--> statement-breakpoint
CREATE TABLE `preference_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`traits` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preference_profile_user_unq` ON `preference_profile` (`user_id`);--> statement-breakpoint
CREATE TABLE `theme` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '✦' NOT NULL,
	`color` text DEFAULT '#587462' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `theme_user_idx` ON `theme` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`google_account_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_google_account_id_unq` ON `user` (`google_account_id`);--> statement-breakpoint
CREATE TABLE `visit_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`start_location` text,
	`planned_date` text,
	`stops` text DEFAULT '[]' NOT NULL,
	`total_duration_min` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `visit_plan_user_idx` ON `visit_plan` (`user_id`);