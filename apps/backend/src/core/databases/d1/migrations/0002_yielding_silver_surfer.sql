DROP INDEX `unique_hotfix_idx`;--> statement-breakpoint
ALTER TABLE `hotfixes` ADD `unique_filename` text;--> statement-breakpoint
CREATE INDEX `section_idx` ON `hotfixes` (`section`);--> statement-breakpoint
CREATE INDEX `key_idx` ON `hotfixes` (`key`);