CREATE TABLE `reply_tracker` (
	`original_message_id` text PRIMARY KEY NOT NULL,
	`reply_message_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `server_config` (
	`server_id` text PRIMARY KEY NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL
);
