CREATE TABLE `pendingTasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`runId` integer NOT NULL,
	`language` text NOT NULL,
	`exercise` text NOT NULL,
	`pid` integer,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pendingTasks_language_exercise_idx` ON `pendingTasks` (`runId`,`language`,`exercise`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model` text NOT NULL,
	`description` text,
	`pid` integer,
	`socketPath` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`runId` integer NOT NULL,
	`language` text NOT NULL,
	`exercise` text NOT NULL,
	`tokensIn` integer NOT NULL,
	`tokensOut` integer NOT NULL,
	`tokensContext` integer NOT NULL,
	`cacheWrites` integer NOT NULL,
	`cacheReads` integer NOT NULL,
	`cost` real NOT NULL,
	`duration` integer NOT NULL,
	`passed` integer,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_language_exercise_idx` ON `tasks` (`runId`,`language`,`exercise`);