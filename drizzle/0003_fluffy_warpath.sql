CREATE TABLE `authSessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
-- Preserve every numeric user ID and all report/notification/assignment references.
-- Retain the oldest account for each normalized email; disable ambiguous accounts
-- using unique reserved addresses. No password is assigned automatically.
CREATE TEMPORARY TABLE `civicfix_email_migration` AS
SELECT u.id,
 CASE WHEN u.email IS NULL OR TRIM(u.email) = ''
 OR LOWER(TRIM(u.email)) LIKE '%@migration.invalid' OR EXISTS (
  SELECT 1 FROM users earlier WHERE earlier.id < u.id
  AND LOWER(TRIM(earlier.email)) = LOWER(TRIM(u.email))
 ) THEN CONCAT('legacy-', u.id, '@migration.invalid')
 ELSE LOWER(TRIM(u.email)) END AS normalizedEmail
FROM users u;--> statement-breakpoint
UPDATE users u JOIN civicfix_email_migration m ON u.id = m.id
SET u.email = m.normalizedEmail, u.role = 'user';--> statement-breakpoint
DROP TEMPORARY TABLE civicfix_email_migration;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;
