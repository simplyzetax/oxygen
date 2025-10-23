CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`secret` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_email_idx` ON `account` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_secret_unique_idx` ON `account` (`secret`);--> statement-breakpoint
CREATE TABLE `meta` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
