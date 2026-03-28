CREATE TABLE `failed_suppresses` (
	`message_id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`created_at` integer NOT NULL
);
