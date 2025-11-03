CREATE TABLE `store_hours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`monday` text NOT NULL,
	`tuesday` text NOT NULL,
	`wednesday` text NOT NULL,
	`thursday` text NOT NULL,
	`friday` text NOT NULL,
	`saturday` text NOT NULL,
	`sunday` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menu_items_name_unique` ON `menu_items` (`name`);--> statement-breakpoint
CREATE TABLE `daily_special` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`description` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`valid_from` integer,
	`valid_to` integer
);
