CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationId` int,
	`actorUserId` int,
	`action` varchar(80) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(32) NOT NULL,
	`participantUserId` int,
	`guardianUserId` int,
	`role` varchar(80) NOT NULL,
	`dateOfBirth` varchar(10) NOT NULL,
	`isMinor` int NOT NULL DEFAULT 0,
	`status` enum('Draft','Submitted','Needs correction','Approved','Exported') NOT NULL DEFAULT 'Draft',
	`payload` text NOT NULL,
	`sourceRevision` varchar(64) NOT NULL DEFAULT 'wsj-fields.json',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `registrations_reference_unique` UNIQUE(`reference`)
);
