CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reportId` int,
	`message` text NOT NULL,
	`type` varchar(64) NOT NULL DEFAULT 'status_update',
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reportEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`status` enum('Submitted','Under Review','Assigned','In Progress','Resolved') NOT NULL,
	`title` varchar(160) NOT NULL,
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` varchar(32) NOT NULL,
	`userId` int,
	`issueType` varchar(80) NOT NULL,
	`category` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`imageUrl` text,
	`imageKey` text,
	`latitude` decimal(10,6) NOT NULL,
	`longitude` decimal(10,6) NOT NULL,
	`address` text NOT NULL,
	`severity` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
	`confidence` decimal(4,3) NOT NULL,
	`potentialRisk` text NOT NULL,
	`priority` enum('LOW','MEDIUM','HIGH','URGENT') NOT NULL,
	`department` varchar(120) NOT NULL,
	`assignedOfficer` varchar(120),
	`status` enum('Submitted','Under Review','Assigned','In Progress','Resolved') NOT NULL DEFAULT 'Submitted',
	`isDemo` int NOT NULL DEFAULT 0,
	`resolutionNote` text,
	`resolutionImageUrl` text,
	`resolutionImageKey` text,
	`verificationScore` decimal(5,2),
	`verificationExplanation` text,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `reports_reportId_unique` UNIQUE(`reportId`)
);
