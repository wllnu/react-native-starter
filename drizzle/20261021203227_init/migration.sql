CREATE TABLE `notes` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notes_created_idx` ON `notes` (`created_at`);