-- Add columns (nullable for existing data, defaults will apply to new rows via schema)
ALTER TABLE `daily_special` ADD `created_at` integer;--> statement-breakpoint
ALTER TABLE `daily_special` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `daily_special` ADD `deleted_at` integer;--> statement-breakpoint
-- Populate existing rows with current timestamp (Unix epoch seconds)
UPDATE `daily_special` SET `created_at` = CAST(strftime('%s', 'now') AS integer) WHERE `created_at` IS NULL;--> statement-breakpoint
UPDATE `daily_special` SET `updated_at` = CAST(strftime('%s', 'now') AS integer) WHERE `updated_at` IS NULL;