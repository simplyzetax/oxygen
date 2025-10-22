CREATE TABLE `content` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_id_idx` ON `content` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_key_unique_idx` ON `content` (`key`);--> statement-breakpoint
CREATE TABLE `hotfixes` (
	`id` text PRIMARY KEY NOT NULL,
	`file` text NOT NULL,
	`section` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `filename_idx` ON `hotfixes` (`file`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_hotfix_idx` ON `hotfixes` (`file`,`section`,`key`);