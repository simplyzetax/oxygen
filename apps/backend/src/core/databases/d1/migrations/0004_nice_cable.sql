CREATE TABLE `attributes` (
	`account_secret` text NOT NULL,
	`profile_id` text NOT NULL,
	`key` text NOT NULL,
	`value_json` text NOT NULL,
	FOREIGN KEY (`account_secret`) REFERENCES `account`(`secret`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attr_id_idx` ON `attributes` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attr_profile_key_unique_idx` ON `attributes` (`profile_id`,`key`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`account_secret` text NOT NULL,
	`profile_id` text NOT NULL,
	`attributes` text DEFAULT '{"item_seen":true,"variants":[]}' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`favorite` integer DEFAULT false,
	`has_seen` integer DEFAULT false,
	FOREIGN KEY (`account_secret`) REFERENCES `account`(`secret`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `items_profile_id_idx` ON `items` (`profile_id`);--> statement-breakpoint
CREATE INDEX `items_template_id_idx` ON `items` (`template_id`);